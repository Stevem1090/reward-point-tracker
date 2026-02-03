

# Fix Library Recipe Selection - Updated Plan

## Changes from Previous Plan

| Aspect | Previous | Updated |
|--------|----------|---------|
| **1-2 star recipes** | Low weight (0.3) - still possible | **Excluded entirely** |
| All other logic | Same | Same |

---

## Updated Weight Logic

```typescript
// Score and weight recipes - EXCLUDE low-rated ones entirely
const scoredRecipes: SavedRecipeWithScore[] = availableRecipes
  .map(r => {
    const ratingData = ratingMap.get(r.id);
    const avgRating = ratingData ? ratingData.total / ratingData.count : 0;
    const useCount = ratingData?.count || 0;
    
    return { ...r, avgRating, useCount };
  })
  .filter(r => {
    // EXCLUDE recipes rated 1-2 stars (never suggest again)
    if (r.avgRating > 0 && r.avgRating < 3) {
      console.log(`Excluding low-rated recipe: ${r.name} (${r.avgRating} stars)`);
      return false;
    }
    return true;
  })
  .map(r => {
    // Weight formula for remaining recipes
    let weight = 0.5; // Base weight for unrated recipes
    
    if (r.avgRating >= 4) {
      weight = 3.0 + (r.avgRating - 4); // 4-star = 3.0, 5-star = 4.0
    } else if (r.avgRating >= 3) {
      weight = 1.5; // 3-star = modest weight
    }
    // Unrated (avgRating = 0) keeps base weight of 0.5
    
    // Bonus for frequently used (family favorite)
    if (r.useCount >= 3) weight += 0.5;
    
    return { ...r, weight };
  });
```

---

## Updated Weight Distribution Example

| Recipe | Avg Rating | Use Count | Weight | Included? |
|--------|-----------|-----------|--------|-----------|
| Spaghetti Bolognese | 5.0 | 4 | 4.5 | Yes |
| Chicken Tikka | 4.2 | 2 | 3.2 | Yes |
| Fish Pie | 3.5 | 1 | 1.5 | Yes |
| New Recipe (unrated) | 0 | 0 | 0.5 | Yes |
| Beef Tacos | 1.5 | 2 | - | **No (excluded)** |
| Lamb Tagine | 2.0 | 1 | - | **No (excluded)** |

---

## Full Implementation Plan

### 1. Edge Function (`supabase/functions/generate-meal-plan/index.ts`)

**Update `fetchSavedRecipes`:**
- Fix date check to use `meal_plans.week_start_date` instead of `meals.created_at`
- Exclude recipes rated 1-2 stars entirely
- Apply weighted random selection for remaining recipes
- Return max 5 candidates to AI

### 2. Frontend Hook (`src/hooks/useAIMealGeneration.ts`)

**Update `GeneratedMeal` interface:**
```typescript
interface GeneratedMeal {
  // ... existing fields ...
  recipe_id?: string | null;
  source_type?: MealSourceType;
}
```

**Update meal insertion to use these fields:**
```typescript
const mealsToInsert = meals.map((meal, index) => ({
  // ... existing fields ...
  recipe_id: meal.recipe_id || null,
  source_type: (meal.source_type || 'ai_generated') as MealSourceType,
}));
```

### 3. UI Component (`src/components/meals/MealSlot.tsx`)

**Show "Library Recipe" indicator:**
- When `meal.recipe_id` is set, show a badge/link instead of URL input prompt
- Allow clicking to view the saved recipe details

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-meal-plan/index.ts` | Fix date check, exclude 1-2 star recipes, weighted random selection |
| `src/hooks/useAIMealGeneration.ts` | Add `recipe_id` and `source_type` to interface and insertion |
| `src/components/meals/MealSlot.tsx` | Show library recipe indicator when `recipe_id` is present |

---

## Recipe Eligibility Summary

| Rating | Eligible for AI Suggestions? |
|--------|------------------------------|
| 5 stars | Yes - highest weight (4.0-4.5) |
| 4 stars | Yes - high weight (3.0-3.5) |
| 3 stars | Yes - modest weight (1.5) |
| Unrated | Yes - low weight (0.5) for discovery |
| 1-2 stars | **No - excluded entirely** |

