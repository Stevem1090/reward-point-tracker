# Slimming World Tracker

A new section for logging Slimming World food, **Swips** (formerly "syns"), and Healthy Extras (Calcium / Fibre / Healthy Fats), with optional integration into the existing Meal Planner.

## 1. Navigation

- Add a new top-level menu item **"Slimming World"** to the sidebar + mobile sheet in `AppLayout.tsx`, route `/slimming-world`.
- From the Meal Planner (recipe edit dialog and weekly meal cards) add a **"Log to SW"** quick action that creates a tracker entry for today.

## 2. Terminology

- Throughout the UI use **"Swips"** (not "syns"). Database columns also use `swips`.
- Healthy Extras: **Calcium**, **Fibre**, **Healthy Fats**.
- Speed foods get a separate **Speed** tick flag.

## 3. Data model (new tables)

- **sw_foods** — saved food library
  - `name`, `weight` (text, e.g. "100g"), `swips` (numeric, default 0, decimals allowed), `is_free` (bool), `healthy_extra_type` (enum: `calcium` | `fibre` | `healthy_fats` | null), `healthy_extra_amount` (numeric, default 1, decimals allowed), `is_speed` (bool), `user_id`
- **sw_meals** — combinations of foods (a saved "meal")
  - `name`, `notes`, `user_id`
- **sw_meal_items** — link table: `meal_id`, `food_id`, `quantity` (numeric, default 1)
- **sw_log_entries** — daily tracker rows
  - `user_id`, `log_date` (date), `entry_type` (`food` | `meal` | `recipe`), `food_id` / `meal_id` / `recipe_id` (nullable), `name_snapshot`, `swips_snapshot`, `healthy_extra_type_snapshot`, `healthy_extra_amount_snapshot`, `is_speed_snapshot`, `quantity` (numeric, default 1), `created_at`
- **recipes** + **meals** tables: add nullable `sw_swips`, `sw_healthy_extra_type`, `sw_healthy_extra_amount`, `sw_is_speed` columns (optional).
- All new tables get RLS scoped to `auth.uid() = user_id`.

## 4. Food library (`/slimming-world` → "Foods" tab)

- Searchable list of saved foods.
- "Add food" dialog with fields: **Name**, **Weight**, **Swips** (decimal), large **"Free" CTA button** that sets swips to 0 and toggles `is_free`, **Healthy Extra** dropdown (None / Calcium / Fibre / Healthy Fats) + amount (decimal, default 1.0), **Speed** checkbox.
- Edit / delete actions.

## 5. SW Meals ("Meals" tab inside SW section)

- List of saved SW meals with computed totals (swips, HE breakdown, speed flag).
- "Create meal" flow: name + add foods from library with quantity. Totals auto-calculate from member foods.
- Edit / delete.

## 6. Daily tracker ("Today" tab — default view)

- **Week strip** at the top showing Mon–Sun (current day highlighted), with arrows to navigate previous/next weeks. Defaults to current week. Tapping a day loads its log.
- **Daily summary card**:
  - **Total Swips today** — large counter. **Turns red when the day's total exceeds 15.**
  - Healthy Extra usage: Calcium x.x / 1, Fibre x.x / 1, Healthy Fats x.x / 1, each with a progress bar.
- **Add button** opens a sheet with three tabs: **Food** / **SW Meal** / **Recipe** (from the existing meal planner library). Pick an item + quantity, then log it.
- **Healthy Extra → Swips auto-conversion**:
  - Sum logged HE amounts of each type for the day.
  - First cumulative **1.0** of a type counts as the Healthy Extra (decimals stack — 0.5 + 0.5 = one HE, not Swips).
  - Any amount **above 1.0** is converted to Swips using the food's own `swips` value (option 1 — HE-only foods with 0 swips simply show a "HE limit reached" warning and add nothing).
  - Show a small badge on overflow entries: "Counted as Swips (HE limit reached)".
- **Accordion list** of the day's entries (collapsed by default). Each row shows name, qty, swips, HE chips, speed icon. Expand for granular detail.
- Delete entries inline.

## 7. Meal Planner integration

- **Add/Edit Recipe dialogs** (`AddRecipeDialog.tsx`, `EditRecipeDialog.tsx`): add an optional **"Slimming World"** section (Swips / HE type / HE amount / Speed).
- **Recipe cards** (`RecipeCardDialog.tsx`) and **meal slot cards** (`MealSlot.tsx`): show small SW badges when set (e.g. "4 Swips • HE Calcium • Speed").
- **"Log to SW today"** button on meal cards and recipe library rows → creates an `sw_log_entries` row of type `recipe` for today.
- All SW fields on recipes/meals are optional and editable later.

## 8. Technical notes

- New page `src/pages/SlimmingWorldPage.tsx` with internal Tabs (Today / Foods / Meals).
- New folder `src/components/slimming-world/` (FoodLibrary, FoodForm, MealLibrary, MealForm, DailyTracker, WeekStrip, DailySummary, AddEntrySheet, EntryRow).
- New hooks: `useSwFoods`, `useSwMeals`, `useSwLog`.
- Reuse shadcn primitives (Tabs, Sheet, Accordion, Progress, Dialog, Input, Select).
- Decimal inputs use `step="0.1"`. All numeric DB columns use `numeric`.
- Mon-start week handling matches existing meal planner (`getWeekBounds.ts`).
- The 15-Swip red threshold lives as a constant (`SWIPS_DAILY_LIMIT = 15`) so it's easy to tweak later.

```text
Slimming World page
├── Today tab     ── WeekStrip ── DailySummary (Swips counter goes red >15) ── AddEntrySheet ── Accordion of entries
├── Foods tab     ── searchable list ── Add/Edit food dialog (with big "Free" CTA)
└── Meals tab     ── list with totals ── Create/Edit meal dialog

Meal Planner
├── Recipe forms       → optional SW fields (Swips / HE / Speed)
├── Meal/Recipe cards  → SW badges + "Log to SW" button
```
