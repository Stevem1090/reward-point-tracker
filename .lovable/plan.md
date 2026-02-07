

# Three Tweaks to the Meal Planning UI

## 1. Replace Delete button on green banner with dismiss X

The green "Meal plan approved!" banner currently has a destructive Delete button. This will be replaced with a simple X (close) icon button that dismisses the banner for the session.

### Technical Details

**File: `src/components/meals/MealPlanView.tsx`**

- Add a `const [isBannerDismissed, setIsBannerDismissed] = useState(false)` state
- Change the banner condition from `{isPlanFinalised && (` to `{isPlanFinalised && !isBannerDismissed && (`
- Replace the Delete `<Button>` with an X icon button that calls `setIsBannerDismissed(true)`
- The delete plan functionality remains available via the draft plan's "Delete Plan" button (which still exists at the bottom of draft plans)

---

## 2. Ingredient search drawer on the Plan tab

A new search feature accessible from a button on the Plan tab. Opens a Drawer (bottom sheet on mobile) where users can type an ingredient name (e.g. "mushrooms") and see which recipes in the current week's plan contain it, along with quantities.

### How it works

- Searches through `recipe_card.ingredients` on all approved meals in the current plan
- Matches ingredient names case-insensitively against the search term
- Displays results as a list: recipe name + matched ingredient quantity/unit/name

### Technical Details

**File: `src/components/meals/IngredientSearchDrawer.tsx` (new file)**

- Uses the `Drawer` component from `vaul` (already in the project)
- Props: `meals: MealWithRecipeCard[]` (the current plan's meals)
- Contains an `Input` for search, filters meals' `recipe_card.ingredients` by name match
- Shows results grouped by recipe name with ingredient details

**File: `src/components/meals/MealPlanView.tsx`**

- Import and render `IngredientSearchDrawer` on finalized plans
- Add a `Search` icon button near the banner or above the meal list to open the drawer
- Pass `mealPlan.meals` to the drawer component

---

## 3. Search in SwapMealDialog library tab

Add a search input at the top of the "From Library" tab in the replace meal dialog, filtering recipes by name.

### Technical Details

**File: `src/components/meals/SwapMealDialog.tsx`**

- Add `const [searchQuery, setSearchQuery] = useState('')` state
- Add a search `Input` with a `Search` icon above the recipe list in the library tab
- Filter `recipes` by `recipe.name.toLowerCase().includes(searchQuery.toLowerCase())`
- Reset search query in `resetForm()`
- Show "No matching recipes" message when filter returns empty but recipes exist

---

## Files to modify

| File | Change |
|------|--------|
| `src/components/meals/MealPlanView.tsx` | Replace Delete with dismiss X on banner; add ingredient search button + drawer |
| `src/components/meals/IngredientSearchDrawer.tsx` | New file - drawer component for ingredient search |
| `src/components/meals/SwapMealDialog.tsx` | Add search input to filter library recipes by name |

