## Problem

When a user replaces/adds a meal via the new **Photo** tab in `SwapMealDialog`, the cookbook extraction succeeds (name, description, servings, cook time, ingredients, steps are returned by `process-cookbook-recipe`) — but only the four scalar fields are forwarded to `onSwap`. The `ingredients` and `steps` arrays are discarded, so the meal is created as a bare row with no recipe content attached and the recipe modal shows nothing.

The Library tab works because it passes `recipeId`, which links the meal to an existing `recipes` row that already holds ingredients/steps. The Photo tab has no such row to link to.

## Fix

Mirror the AddRecipeDialog flow: after a successful photo extraction, **persist the extracted recipe into the user's `recipes` library**, then pass its new `recipeId` through `onSwap` (alongside the existing scalar fields). This guarantees ingredients/steps survive and the meal slot/modal can render them — and as a bonus the recipe is reusable from the Library tab next time.

### Changes

**`src/components/meals/SwapMealDialog.tsx`**
- Import `useRecipes` and call `createRecipe` from it.
- In `handlePhotoSubmit`, after `processCookbook.mutateAsync(...)` resolves:
  1. Guard: if `recipe.ingredients.length === 0` or `recipe.steps.length === 0`, toast an error ("Couldn't read ingredients/steps from those photos — try clearer pages") and stop, matching `AddRecipeDialog`'s validation.
  2. Call `createRecipe.mutateAsync({...})` with the extracted fields, `source_type: 'cookbook'`, `cookbook_title: cookbookTitle || null`, `recipe_url: null`, `image_url: recipe.image_url ?? null`.
  3. Call `onSwap({ mealName, description, servings, estimatedCookMinutes, recipeId: created.id })` so the meal links to the new library row.
- Suppress the duplicate "Recipe saved!" toast from `createRecipe` for this flow by showing a single success toast here (or leave it — minor; prefer leaving the default toast for consistency).
- Extend the button's loading state to also reflect `createRecipe.isPending` so the UI shows progress through both steps.

### Out of scope
- No edge-function changes — `process-cookbook-recipe` already returns ingredients/steps correctly.
- No changes to the Library or Custom tabs.
- No changes to `MealSlot`/`MealPlanView` swap handlers; they already accept `recipeId`.

### Files touched
- `src/components/meals/SwapMealDialog.tsx`
