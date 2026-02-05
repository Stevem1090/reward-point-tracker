

# Fix Library Recipe Handling During Finalization

## Two Bugs Identified

### Bug 1: Unnecessary Recipe Extraction for Library Meals
In `MealPlanView.tsx`, `handleFinalisePlan` (line 166) runs `extractFromUrl` for **every** approved meal -- including library meals that already have full recipe data saved in the `recipes` table. This wastes AI credits, slows finalization, and can fail.

**Fix:** Before the extraction loop, check if a meal has `recipe_id` set. If it does, skip the URL extraction and instead create a `recipe_card` directly from the existing recipe data in the `recipes` table.

### Bug 2: Library Recipe Link Disappears After Finalization
The "Library Recipe" badge (line 424) has a condition `!isPlanFinalised`, so it's hidden once the plan is approved. And the "View Recipe" button (line 411) requires `meal.recipe_card` to exist -- but if we skip extraction for library meals (Bug 1 fix), no recipe_card would be created unless we handle it.

**Fix:** The Bug 1 fix will create recipe_cards from library data, so the "View Recipe" button will work. Additionally, show the "Library Recipe" badge on finalized plans too, so users can see which meals came from their library.

---

## Technical Changes

### File 1: `src/components/meals/MealPlanView.tsx`

Update `handleFinalisePlan` to handle library meals differently:

```
for (const meal of approvedMeals) {
  // If meal has a recipe_id, it's from the library -- 
  // create recipe_card from existing recipe data instead of extracting
  if (meal.recipe_id) {
    // Fetch the recipe from the library
    const { data: recipe } = await supabase
      .from('recipes')
      .select('name, ingredients, steps, servings, image_url')
      .eq('id', meal.recipe_id)
      .single();
    
    if (recipe) {
      // Create/update recipe_card from library data
      const { data: existing } = await supabase
        .from('recipe_cards')
        .select('id')
        .eq('meal_id', meal.id)
        .maybeSingle();
      
      const cardData = {
        meal_id: meal.id,
        meal_name: recipe.name,
        image_url: recipe.image_url,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        base_servings: recipe.servings,
      };
      
      if (existing) {
        await supabase.from('recipe_cards').update(cardData).eq('id', existing.id);
      } else {
        await supabase.from('recipe_cards').insert([cardData]);
      }
      successCount++;
    }
  } else {
    // Existing extraction logic for non-library meals
    await extractFromUrl.mutateAsync({ ... });
    successCount++;
  }
}
```

### File 2: `src/components/meals/MealSlot.tsx`

Update the Library Recipe badge to also show on finalized plans:

**Current (line 424):**
```
{!isPlanFinalised && meal.recipe_id && !meal.recipe_url && (
```

**Updated:**
```
{meal.recipe_id && (
```

This shows the "Library Recipe" badge both before and after finalization. The "View Recipe" button will also work because the recipe_card is now created from library data.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/meals/MealPlanView.tsx` | Skip extraction for library meals; create recipe_card from `recipes` table instead |
| `src/components/meals/MealSlot.tsx` | Show "Library Recipe" badge on finalized plans too |

---

## How It Works After the Fix

| Meal Type | During Finalization | After Finalization |
|-----------|--------------------|--------------------|
| AI-generated (with URL) | Extracts recipe from URL, creates recipe_card | Shows "View Recipe" link |
| AI-generated (no URL) | Creates placeholder recipe_card via AI fallback | Shows "View Link" |
| Library recipe | Creates recipe_card from saved recipe data (no extraction needed) | Shows "Library Recipe" badge + "View Recipe" link |

