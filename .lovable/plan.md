## Goal

Let you add Slimming World info (Swips, Healthy Extra type/amount, Speed) to any recipe straight from the weekly plan — without needing to find it in the Library first.

## UX

In the recipe preview that opens when you tap **View recipe** on a meal slot (`RecipeCardDialog`):

- If the recipe has no SW info yet: show a small **"Add SW info"** button next to the existing SW summary area.
- If it does: show **"Edit SW info"**.

Tapping it opens a focused dialog with just four fields:

```
Swips           [ number ]
Healthy Extra   [ none | A | B ]
Amount          [ number ]   (hidden when type = none)
Speed food      [ toggle ]
```

Save → updates the linked recipe → toast → preview refreshes immediately.

## Handling unlinked meals

If the meal slot has no `recipe_id` (AI meal that wasn't saved to the library yet), the save flow does this in one step:

1. Create a recipe in `recipes` using the meal's name, description, cook time, servings, and — if the meal has a `recipe_card` — its `ingredients`, `steps`, and `image_url`.
2. Update the `meals` row's `recipe_id` to point at the new recipe.
3. Save the SW fields onto that recipe.

(The DB trigger added previously will also auto-link other meals with the same name going forward.)

## Files to change

- `src/components/meals/SwInfoDialog.tsx` *(new)* — the SW-only quick editor.
- `src/components/meals/RecipeCardDialog.tsx` — add the "Add/Edit SW info" button and wire it to the new dialog. Reuse the existing `recipeSwData` + refetch path.
- `src/hooks/useRecipes.ts` — add an `upsertSwInfo({ mealId, recipeId, sw })` mutation that handles both the linked and unlinked cases (auto-creates a recipe if needed, sets `meals.recipe_id`, then writes SW fields).

No DB migration needed — `recipes.sw_*` columns and the `meals.recipe_id` link already exist.

## Out of scope

- Editing SW info from the meal slot dropdown or the History tab.
- Bulk "tag this whole week" workflow.
- Changing how SW info is displayed elsewhere (already shown in slot, preview, library, SW log).
