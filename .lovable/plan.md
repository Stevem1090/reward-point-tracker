## Chores tracker — UX & cleanup pass

Five focused changes to address accidental taps, category management, density, and clarity.

### 1. Replace single tap with double-tap (anti-scroll)

In `ChoreCard.tsx`, swap the tap-to-log gesture for a **double-tap** (≤300ms between taps on the same grid). Long-press to undo stays at 600ms. Single tap does nothing — this prevents accidental logs while scrolling.

Update the helper text below the grid to: *"Double-tap to log. Long-press to undo this {week|month}."*

We'll also cancel the long-press timer immediately on any pointer-move >10px (already in place) so scrolling never triggers undo either.

### 2. Categories collapsed by default

In `CategoryAccordion.tsx`, remove `defaultValue={data.map(d => d.category.id)}` so all categories start collapsed. The header badge ("`x/y` done this week") already gives an at-a-glance summary, so users can open only what needs attention.

### 3. Category management — fix duplicates, allow delete, hide empties

**Add-chore duplicate fix (`AddChoreDialog.tsx`)**: the submit handler can fire twice if the button is double-tapped. Disable the button while in-flight (local `submitting` state) and guard `handleSubmit` with an early-return.

**Delete category**: `useChores` already exposes `deleteCategory` but it's not wired up. Add a small kebab/trash button on the category accordion header (next to the badge) that opens a confirm dialog. Deleting cascades only if empty; if chores exist, show a toast: *"Move or delete chores first."* (Check `chores.length === 0` client-side before calling.)

**Hide empty categories**: in `CategoryAccordion.tsx`, filter `data` to `chores.length > 0` by default. Add a small "Manage categories" link/button at the bottom of the page that opens a sheet listing **all** categories (including empty) with rename + delete actions. This keeps the main view clean without losing the ability to clean up empties.

### 4. Tighter card UI for mobile density

In `ChoreCard.tsx`:
- Reduce `Card` padding from `p-3` to `p-2`.
- Collapse the header row: put the chore name and frequency on one line (`name · weekly` in muted text), drop the separate frequency line.
- Shrink the trash button from `h-11 w-11` to `h-8 w-8` (still ≥32px; the grid itself is the primary 44px target so this is fine).
- Remove the helper text line under the grid (move it to a single tooltip/info icon at the page level, or show it once as a dismissible hint on first visit).
- Reduce grid gap from `gap-[3px]` to `gap-[2px]` in `ChoreGrid.tsx` and tighten card vertical spacing (`space-y-2` → `space-y-1.5`).

Estimated result: ~3–4 chores visible per mobile screen instead of 2.

### 5. Clearer "done this week" indicator

In `ChoreGrid.tsx`, the current week's cell already gets a ring, but it's subtle. Strengthen it:
- Current week (not yet done): `ring-2 ring-kid-purple/60` + `bg-background` (not muted) so it visually "pops" as the actionable cell.
- Current week (done): keep filled purple, but add a small **white check mark** glyph (✓) inside instead of leaving it blank, and bump ring to `ring-2 ring-kid-purple ring-offset-1`.
- Add a short "This week: ✓ Done" or "This week: Not yet" pill in the card header next to the chore name (driven by whether any completion falls in `getThisWeekBounds()`). This gives users an immediate textual answer without scanning the grid.

For monthly chores, same treatment using current-month bounds and label "This month".

### Files to edit

- `src/components/chores/ChoreCard.tsx` — double-tap, tighter header, this-week pill, smaller trash btn
- `src/components/chores/ChoreGrid.tsx` — tighter gaps, stronger current-period styling, check glyph
- `src/components/chores/CategoryAccordion.tsx` — collapsed by default, hide empties, delete-category control
- `src/components/chores/AddChoreDialog.tsx` — submit guard against double-fire
- `src/pages/ChoresPage.tsx` — wire up `deleteCategory`, add "Manage categories" sheet for empty categories

### Technical notes

- Double-tap implementation: track `lastTapAt` ref; on `pointerup` (when not long-press), if `now - lastTapAt < 300`, fire `onLog` and reset; otherwise store `now`. No reliance on browser `dblclick` (unreliable on touch).
- "This week" pill: derive from `chore.completions` + `getThisWeekBounds()` inside `ChoreCard` (cheap, already passed in).
- Manage-categories sheet: simple list using existing `Sheet` UI primitive; calls `deleteCategory` on confirm. No new hook surface needed.
- No DB migrations required.
