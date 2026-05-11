
# Connect Meal Plan, Library & Slimming World

The three areas currently behave as silos: ratings live per `meal_id` (so reviews vanish next time you eat the same dish), the library doesn't show stars/history, AI generation rarely picks from your library and gives no way to peek before approval, and SW logging is only really discoverable inside the SW tab. This plan stitches them together and tidies up the recipe library along the way.

## 1. Recipe library cleanup (one-off migration)

A scan found 100 recipes, 22 with no ingredients/steps, and 5 duplicate name pairs.

- Delete recipes where `ingredients` is empty AND `steps` is empty (22 rows).
- Deduplicate by case-insensitive trimmed `name`: keep the row with the most content (longest ingredients array, then most-recent `updated_at`); merge any `meals.recipe_id` references onto the kept row before deleting the loser.
- Add a soft guard in `AddRecipeDialog`/`EditRecipeDialog` so a recipe can't be saved with zero ingredients.

## 2. Make ratings recipe-centric (so reviews follow the dish)

- Add `recipe_id uuid` to `meal_ratings`; backfill from `meals.recipe_id`.
- New `useRecipeStats(recipeId)` hook returning `{ avgRating, ratingCount, timesEaten, lastEatenDate }` aggregated across all historical `meals` rows tied to that recipe.
- Rating UI continues to write `meal_id` but also stamps `recipe_id` so future occurrences inherit history.

## 3. Library: show stars, history, sorting

In `RecipeLibrary`:
- Each card shows: avg star rating + count, times eaten, last eaten date.
- Sort: **Most recent**, **Highest rated**, **Most cooked**, **Recently eaten**, **A–Z**.
- Filter chips: **Has SW info**, **Quick (<30m)**, **Unrated**.
- Card click → existing `RecipeCardDialog` also shows rating summary + last 3 review notes.

## 4. AI generation pulls from the library (token-light)

`generate-meal-plan` already accepts library context but rarely uses it. We send a **compact summary** only — not full recipes:

```
{ id, name, avg_rating, times_eaten, last_eaten_days_ago,
  cook_minutes, has_sw, one_line_description }
```

≈40–60 tokens per recipe × ~80 valid recipes ≈ **4–6k tokens**, comfortably within Gemini Pro context. Full ingredients/steps stay in the DB and are only fetched when the user opens the recipe.

Prompt rules:
- Aim for **40–60% of weekly meals from the library**.
- Bias toward higher rating + not-recently-eaten.
- Existing variety/personalisation/rejection memory rules still apply.
- When picking a library recipe, return its `recipe_id` and `source_type: 'user_library'`.

## 5. Preview before approval + ratings on the slot

In `MealSlot` (pending state):
- "View recipe" button when `recipe_id` or `recipe_card` exists → opens `RecipeCardDialog` before approve/reject.
- Lifetime stars under meal name (e.g. ★ 4.6 · 3×).
- "From your library" badge for `source_type = 'user_library'`.

## 6. History view: weekly score uses recipe history

`MealPlanHistory`:
- If a meal isn't yet rated this week, show the recipe's lifetime average greyed, plus "Rated 4★ last time" if applicable.
- Weekly badge = average of this week's ratings, falling back to recipe lifetime averages.

## 7. Slimming World: more entry points

- **Recipe Library cards** & `RecipeCardDialog`: "Log to SW" quick action when `sw_swips != null`.
- **Meal Plan slot**: promote "Log to SW today" from dropdown to a visible chip; add date picker (today / day this week).
- **History (finalised plans)**: per-meal "Log to SW" so past meals can be backfilled.
- **SW `AddEntryDialog`**: add "From this week's plan" group at the top of the Recipes tab; quantity stepper.

## 8. SW data on recipes

Add Swips / Healthy extra type+amount / Speed flag fields to `AddRecipeDialog` and `EditRecipeDialog` (DB columns already exist on `recipes`).

## Technical notes

```text
DB migrations:
  -- 1. cleanup
  DELETE FROM recipes
  WHERE jsonb_array_length(ingredients) = 0
    AND jsonb_array_length(steps) = 0;
  -- dedupe handled by a one-off SQL block: pick winner per
  -- lower(trim(name)), UPDATE meals.recipe_id to winner,
  -- DELETE losers.

  -- 2. recipe-centric ratings
  ALTER TABLE meal_ratings ADD COLUMN recipe_id uuid;
  CREATE INDEX idx_meal_ratings_recipe_id ON meal_ratings(recipe_id);
  UPDATE meal_ratings r SET recipe_id = m.recipe_id
  FROM meals m WHERE m.id = r.meal_id AND m.recipe_id IS NOT NULL;

Edge function update: generate-meal-plan
  - inject compact library summary (see §4)
  - new prompt rules: prefer library, bias by rating + recency

Components touched:
  RecipeLibrary, RecipeCardDialog, MealSlot, SortableMealSlot,
  MealPlanHistory, HistoryMealItem, AddEntryDialog,
  AddRecipeDialog, EditRecipeDialog, useMealRatings, useAIMealGeneration
```

## Out of scope
- Per-user ratings averaging (single household for now).
- SW daily limit/colour logic (already implemented).
- Household sharing model from the previous plan (separate effort).
