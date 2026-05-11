## Problem

The previous migration linked `meal_ratings.recipe_id` only by copying from `meals.recipe_id` — but most historical meals never had `recipe_id` populated (it's only set when the AI matches a generated meal name to a library recipe at plan-generation time). Result:

- 35 total ratings, only **1** linked to a recipe
- 121 total meals, only **31** linked to a recipe
- Library shows "no history" for almost every recipe

## Fix: name-based backfill

Add a single migration that fuzzy-matches by `lower(trim(name))` scoped to `user_id`, so every past meal/rating that shares a name with a library recipe gets linked. Verified counts:

- **62 of 90** unlinked historical meals will link to a library recipe
- **30 of 34** unlinked rated meals will link → ratings start showing in the library

### Migration steps

1. Update `meals.recipe_id` for any meal where `recipe_id IS NULL` and a recipe with the same case-insensitive name exists for the meal-plan's owner.
2. Update `meal_ratings.recipe_id` for any rating where `recipe_id IS NULL`, by joining through `meals` (now backfilled) → `recipes`.
3. Add a small "soft" auto-link going forward: when a meal is inserted/updated without `recipe_id`, a trigger looks up `recipes` by name+user and sets it. (Prevents the gap reopening for any meals created outside the AI flow.)

### What the user will see

- Library cards show real ★ averages, rating counts, "cooked N times", and last-eaten dates for ~62 recipes that were previously blank
- The History tab's "Past avg" hint populates for older weeks
- AI generation gets richer signal (ratings/cook counts) for those recipes

### Out of scope

- The remaining ~28 unlinked meals where the recipe was deleted, renamed, or never saved to the library — these stay unlinked (correct behaviour)
- Cross-user matching (each user's meals only link to their own recipes)

### Technical detail

```sql
-- 1. Link historical meals to library recipes by name
UPDATE meals m
SET recipe_id = r.id
FROM meal_plans mp, recipes r
WHERE m.meal_plan_id = mp.id
  AND m.recipe_id IS NULL
  AND r.user_id = mp.user_id
  AND lower(trim(r.name)) = lower(trim(m.meal_name));

-- 2. Backfill rating links via the now-populated meals.recipe_id
UPDATE meal_ratings mr
SET recipe_id = m.recipe_id
FROM meals m
WHERE mr.meal_id = m.id
  AND mr.recipe_id IS NULL
  AND m.recipe_id IS NOT NULL;

-- 3. Trigger to keep new meals auto-linked
CREATE FUNCTION auto_link_meal_recipe() RETURNS trigger ...
  -- on INSERT/UPDATE of meals, if recipe_id IS NULL,
  -- look up matching recipe by user + name and set it
```
