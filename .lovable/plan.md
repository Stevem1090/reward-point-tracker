

# Meal Planning Enhancements

## 1. Skip days (turn off meals for specific days)

Before plan generation or on a blank plan, users can toggle off specific days. Skipped days show "No Meal Planned" on finalized plans and are excluded from shopping list generation.

### Technical approach
- **Database**: Add `meal_type` column to `meals` table (default `'dinner'`, also allows `'breakfast'`, `'lunch'`, `'other'`). No schema change needed for skipping -- we simply delete the meal row for that day or mark it with a special status.
- **Simpler approach**: Use a new status value `'skipped'` on existing meals. When a user skips a day, set `status = 'skipped'`. Skipped meals are excluded from finalization (no recipe extraction, no shopping list). On finalized plans, render as "No Meal Planned".
- **`MealSlot.tsx`**: Add a toggle/button to skip a day (sets status to `'skipped'`). Show "No Meal Planned" styling for skipped meals on finalized plans.
- **`MealPlanView.tsx`**: Update `allMealsApproved` check to treat skipped meals as valid (approved or skipped). Exclude skipped meals from recipe extraction and shopping list.
- **`useMealPlans.ts`**: Add `skipMeal` mutation that sets status to `'skipped'` and clears meal data, plus `unskipMeal` to restore to pending.

### Database migration
```sql
-- Allow 'skipped' as a valid meal status
-- The status column uses a text type with no CHECK constraint, so no migration needed
```

## 2. Additional meals per day (breakfast, lunch, other)

Users can add extra meals to any day beyond the default dinner. Each additional meal specifies a type (Breakfast, Lunch, or Other).

### Technical approach
- **Database migration**: Add `meal_type` column to `meals` table:
  ```sql
  ALTER TABLE meals ADD COLUMN meal_type text NOT NULL DEFAULT 'dinner';
  ```
- **`MealSlot.tsx`**: Show a meal type badge when not `'dinner'`. Add an "Add Meal" button per day that opens a dialog asking for meal type (Breakfast/Lunch/Other), then opens the SwapMealDialog.
- **`MealPlanView.tsx`**: Group meals by day, rendering multiple slots per day. Update `allMealsApproved` to handle multiple meals per day. Include all approved meals (any type) in finalization and shopping list.
- **`useMealPlans.ts`**: Update `addMealToDay` to accept `mealType` parameter. Update queries to handle multiple meals per day.
- **`getMealForDay`** becomes `getMealsForDay` returning an array.

## 3. Extraction failure banner on finalized plans

After finalization, if any recipe extraction failed (recipe_card exists but has 0 ingredients and meal is not from library), show a persistent but dismissable error banner at the top.

### Technical approach
- **`MealPlanView.tsx`**: After finalization, check for meals where `recipe_card.ingredients.length === 0 && !meal.recipe_id`. Show an Alert banner listing failed meal names. Use localStorage (keyed by `mealPlanId`) to track dismissal so it doesn't reappear.

## 4. Edit meals on finalized plans

Allow users to replace individual meals on an already-finalized plan. When they do, delete the shopping list and regenerate it after the edit.

### Technical approach
- **`MealSlot.tsx`**: When `isPlanFinalised`, show an "Edit" option in a dropdown menu that opens the SwapMealDialog. After swap, delete the existing shopping list and re-run the finalization flow for just the edited meal (extract recipe, then regenerate entire shopping list).
- **`MealPlanView.tsx`**: Add an `editFinalisedMeal` handler that: replaces the meal, deletes existing recipe_card for that meal, extracts recipe for the new meal, deletes shopping list, regenerates shopping list from all current recipe cards.
- **`useMealPlans.ts`**: Add `editFinalisedMeal` mutation. Add `deleteShoppingList` mutation.

---

## Files to modify/create

| File | Changes |
|------|---------|
| `supabase/migrations/` | Add `meal_type` column to `meals` table |
| `src/types/meal.ts` | Add `MealType`, update `Meal` interface with `meal_type` |
| `src/hooks/useMealPlans.ts` | Add `skipMeal`, `unskipMeal`, `editFinalisedMeal` mutations; update `addMealToDay` for meal_type; update queries for multiple meals per day |
| `src/components/meals/MealPlanView.tsx` | Multi-meal per day rendering, skip day support, extraction failure banner, edit-on-finalized flow with shopping list regeneration |
| `src/components/meals/MealSlot.tsx` | Skip toggle, meal type badge, edit button on finalized plans, "No Meal Planned" state |
| `src/components/meals/SwapMealDialog.tsx` | Accept optional meal type context |
| `src/hooks/useShoppingList.ts` | Add `deleteShoppingList` method |

## Implementation order
1. Database migration (add `meal_type` column)
2. Type updates
3. Skip days feature
4. Additional meals feature  
5. Extraction failure banner
6. Edit finalized meals

