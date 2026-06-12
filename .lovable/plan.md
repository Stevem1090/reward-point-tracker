# Meal card tap-to-open + Healthy Extra display

## 1. Whole meal card opens the recipe modal

**File:** `src/components/meals/MealSlot.tsx`

- Add an `onClick` handler to the main `<Card>` (the non-empty / non-skipped render path around line 341) that calls `handleOpenRecipe()` when the meal has a `recipe_card` or `recipe_id` and isn't a blank placeholder.
- Add `role="button"`, `tabIndex={0}` and a keyboard handler (Enter / Space) for accessibility, plus `cursor-pointer` styling when openable.
- Stop event propagation on every interactive child so they keep their own behaviour and don't also trigger the card open:
  - Meal-name button (can keep — same action, but stop propagation to avoid double-open)
  - Google "Search recipe" icon button
  - Approve / Reject buttons (desktop + mobile)
  - The `MoreVertical` `DropdownMenuTrigger` (desktop pending, desktop non-pending, mobile pending, mobile non-pending, finalised desktop, finalised mobile)
  - Servings `Popover` trigger and its `+ / -` buttons
  - URL `<Input>` and Save button
  - Recipe URL `<a>` link and its edit pencil button
  - Empty-slot `+` button and skipped-slot "Restore" button stay as-is (no card-level click on those branches)
- Done via a single `stopPropagation` wrapper on each `onClick`, e.g. `onClick={(e) => { e.stopPropagation(); handleApprove(); }}`.

When the meal has no recipe to open (e.g. blank meal, or URL-only meal with no `recipe_id` / `recipe_card`), the card click is a no-op and `cursor-pointer` is not applied.

## 2. Show Slimming World Healthy Extras

Healthy Extra data already lives on the meal/recipe (`sw_healthy_extra_type`, `sw_healthy_extra_amount`) and is read in both components, but never rendered. Use `HEALTHY_EXTRA_LABELS` from `src/types/slimmingWorld.ts` for display.

### `src/components/meals/MealSlot.tsx` (~line 587)

Extend the SW meta row so a Healthy Extra is shown when present:

```text
[scale icon] {swips} Swips · Speed · HE: {amount}× {Calcium|Fibre|Healthy Fats}
```

- If `swHe` is set, append `· HE: {swHeAmt || 1}× {HEALTHY_EXTRA_LABELS[swHe]}`.
- If only `swHe` is set (no `swSwips`), drop the "Swips" segment so the row reads `HE: 1× Calcium`.
- Import `HEALTHY_EXTRA_LABELS` from `@/types/slimmingWorld`.

### `src/components/meals/RecipeCardDialog.tsx` (~line 257)

Same change in the modal's metadata strip — append the HE segment to the existing SW `<span>` using the same formatting and `HEALTHY_EXTRA_LABELS` import.

## Out of scope

- No DB / edge-function changes.
- No changes to `SwInfoDialog` editing UI, finalised-plan editing flow, or any other component.
- Empty / skipped meal cards remain non-tappable (nothing to open).
