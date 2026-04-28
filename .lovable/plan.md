# Chores Tracker

A category-grouped chore tracker with a year-based achievement grid for repeating tasks, and simple strike-through completion for one-offs.

## Features

- Add chores with: name, category, frequency (`weekly`, `monthly`, `adhoc`).
- **Weekly/monthly chores**: tap a box to log a completion. Multiple completions in the same period show a count.
- **Adhoc chores**: tap checkbox to mark complete → name shown with `line-through` and dimmed. Tap again to undo. Delete to remove.
- Categories rendered as collapsible accordion sections, each with a "done so far this week" counter.
- Year-based grids with a year selector so previous years are preserved.

## UI structure

```
[ Chores ]                              [Year: 2026 ▾] [+ Add chore]

▾ Downstairs                                     4/5 done this week
   ┌─────────────────────────────┐
   │ Hoover lounge   (weekly)    │
   │ ▢▢▢▢▢▢▢▢▢▢▢▢▢                │ ← 52-box grid
   │ ▢▢▢▢▢▢▢▢▢▢▢▢▢                │
   │ ...                          │
   └─────────────────────────────┘
   ┌─────────────────────────────┐
   │ ☐ Fix the skirting board (adhoc)              🗑 │
   └─────────────────────────────┘

▸ Upstairs                                       1/3 done this week
```

- Categories use shadcn `Accordion` (multi-open). Header shows category name + counter chip.
- The counter ("4/5 done this week") is the number of **distinct chores in this category that have been completed at least once in the current Mon–Sun week** out of the total non-adhoc chores in the category. Repeats in the same week do not increase the count. Adhoc chores are excluded from this counter.
- Inside each accordion, repeating chores render as a card with the grid; adhoc chores render as a checkbox row.

## Week handling (Mon–Sun, ISO weeks)

- A "week" runs **Monday 00:00 → Sunday 23:59** local time. Reuses the existing `getWeekBounds` / `getWeekStartDate` helpers from `src/utils/getWeekBounds.ts` (already weekStartsOn: 1).
- Each completion is bucketed into the ISO week of its `completed_at` timestamp.
- The "done this week" counter refreshes automatically as the calendar rolls into Monday — it always reads from the current `getThisWeekBounds()`.
- The grid advances along on Monday: a new week becomes the next slot to fill.

## Year-based grid (with history)

- A **year selector** at the top of the page (defaults to current year). Switching years re-renders all grids using only completions within that year.
- **Weekly chores**: the grid shows **52 boxes representing weeks 1–52 of the selected year, in chronological order** (one box per ISO week of that year — week 53 years are clamped to 52 for layout consistency, with any week-53 completions merged into week 52).
- **Monthly chores**: 12 boxes for Jan–Dec of the selected year.
- **Box state per period (week or month)**:
  - Period is in the **future** → empty, slightly muted (not interactive).
  - Period is **past or current** with **0 completions** → empty box (skipped, stays blank — represents a missed period).
  - Period has **1 completion** → filled.
  - Period has **2+ completions** → filled with a centred count.
- Tooltip shows the period range and completion count, e.g. "Week 14 — 31 Mar to 6 Apr — 2 completions".
- A chore created mid-year still shows boxes for all 52 weeks; weeks before its creation date appear empty (no special treatment needed — they simply have no completions).
- **Year rollover**: nothing is deleted. Completion timestamps live forever in the DB. When the calendar enters a new year, the default year switches to the new year and grids appear empty until completions accrue. Users can switch the year selector back to view any prior year's grid exactly as it was.

So a chore first completed in week 14 of 2026 will show 13 empty boxes followed by a filled box at position 14 — preserving "calendar position" rather than the previously-discussed sequential fill. This better matches the user's expectation of seeing _when_ in the year things happened.

## Mobile layout

- **Weekly grid**: `grid-cols-13` (4 rows × 13), `aspect-square`. Add `grid-cols-13` to `tailwind.config.ts`.
- **Monthly grid**: `grid-cols-12` × 1, `aspect-square`.
- **Adhoc rows**: full-width checkbox row.
- No horizontal scrolling. Accordion headers and "+ Add chore" button use min 44×44px tap targets.

## Database (migrations)

```sql
chore_categories(
  id uuid pk default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  color text default '#8B5CF6',
  sort_order int default 0,
  created_at timestamptz default now()
)

chores(
  id uuid pk default gen_random_uuid(),
  user_id uuid not null,
  category_id uuid not null references chore_categories(id) on delete cascade,
  name text not null,
  frequency text not null check (frequency in ('weekly','monthly','adhoc')),
  completed_at timestamptz,           -- adhoc only; null = open
  archived boolean default false,
  created_at timestamptz default now()
)

chore_completions(
  id uuid pk default gen_random_uuid(),
  chore_id uuid not null references chores(id) on delete cascade,
  user_id uuid not null,
  completed_at timestamptz not null default now()
)
```

RLS on all three: `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE.

## Frontend

New files:
- `src/types/chore.ts`
- `src/hooks/useChores.ts` — fetches categories + chores + completions for the **selected year** with realtime; exposes `addChore`, `logCompletion`, `undoLastCompletion`, `toggleAdhocComplete`, `deleteChore`, plus per-category "completed this week" counts.
- `src/pages/ChoresPage.tsx` — year selector, "Add chore" button, category accordions.
- `src/components/chores/CategoryAccordion.tsx` — accordion item with name + `4/5 done this week` chip.
- `src/components/chores/ChoreCard.tsx` — repeating chore with grid + tap-to-log + undo.
- `src/components/chores/AdhocChoreRow.tsx` — checkbox + strike-through + delete.
- `src/components/chores/ChoreGrid.tsx` — renders 52 / 12 boxes by ISO-week / month index for the selected year.
- `src/components/chores/AddChoreDialog.tsx` — name, category select (with inline "New category"), frequency radio.
- `src/components/chores/YearSelector.tsx` — shadcn Select listing years from the user's earliest completion year through current year (defaults to current).

Routing & nav:
- Add `/chores` route in `src/App.tsx`.
- Add "Chores" link with `ListChecks` icon to `menuLinks` in `src/components/AppLayout.tsx`.

## Counter logic (per category, per week)

In `useChores`:
1. Get current week bounds via `getThisWeekBounds()`.
2. For each category, take its non-adhoc chores.
3. For each such chore, check if it has **at least one** completion with `completed_at` inside the current week.
4. Counter = `(chores with ≥1 completion this week) / (total non-adhoc chores in category)`.
5. Adhoc chores are not counted.

## Grid logic (per chore, per selected year)

In `ChoreGrid`:
1. Group the chore's completions by ISO week (weekly) or by month (monthly), filtered to `selectedYear`.
2. Render 52 (or 12) boxes indexed 1..52 (or 1..12).
3. Each box reads `completionsByPeriod[index]?.length ?? 0` and renders empty / filled / filled-with-count accordingly.
4. Boxes whose period start is in the future relative to "now" render in a muted style and are non-interactive.
5. Clicking a box logs a completion timestamped at `now()` (only allowed when its period is the current period — past/future boxes are read-only). This keeps semantics simple: you log "I did it now"; you don't backfill history.

## Out of scope

- Backfilling historical completions for past weeks.
- Notifications/reminders for chores.
- Sharing chores between household members.
