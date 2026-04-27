# Downgrade AI Model + Add Per-Portion Calorie Estimates

Two independent changes.

## 1. Downgrade meal generation model (cost saving)

**File:** `supabase/functions/generate-meal-plan/index.ts`

- Change `model: "google/gemini-2.5-pro"` → `model: "google/gemini-2.5-flash"`.
- Keep all other variety improvements (themes, two-pass planning, restructured prompt, temperature/penalties) — these still help on Flash.
- No other functions to change (regeneration already routes through this same edge function).

## 2. Per-portion calorie estimation on recipe cards

Calories are derived from the **ingredients list**, so they are computed and stored on `recipe_cards` (which is what holds the extracted ingredients). They are calculated once per recipe card and cached in the DB — not regenerated on every view.

### 2a. Database migration

Add nullable column to `recipe_cards`:
```sql
ALTER TABLE public.recipe_cards
  ADD COLUMN estimated_calories_per_serving INTEGER;
```
Nullable so existing cards continue to work; older cards will be backfilled lazily (see 2d).

### 2b. New edge function: `estimate-calories`

`supabase/functions/estimate-calories/index.ts` — takes `{ ingredients, servings, mealName }`, calls Lovable AI Gateway with `google/gemini-2.5-flash-lite` (cheap, deterministic-enough for nutrition rough estimates) using **tool calling** for structured output:

```
estimate_calories(calories_per_serving: number, confidence: "low"|"medium"|"high")
```

Prompt: "You are a nutrition estimator. Given an ingredient list and serving count, return a realistic estimated calories per single serving. Round to nearest 10. Be a sensible average — UK home cooking."

Auth: validate JWT in code. Includes 429/402 handling.

### 2c. Auto-call on recipe extraction

In `src/hooks/useRecipeExtraction.ts` (`extractFromUrl` mutation) and the equivalent flow for cookbook recipes, after the `recipe_cards` row is inserted/updated with ingredients, fire-and-forget call to `estimate-calories` and update the row with the result. Failure is non-fatal — calorie field stays null.

Same logic added to wherever recipe cards are created (the cookbook processor flow surfacing into a recipe card — confirm exact spot during build).

### 2d. Lazy backfill for existing finalised meals

When a user opens a recipe card (in `RecipeCardDialog`), if `recipe_card.estimated_calories_per_serving` is null AND ingredients are non-empty, trigger the same edge function once and update the row. UI shows "—" or skeleton until it returns.

### 2e. UI display

**Where calories show:**

1. **`RecipeCardDialog`** — add a `Badge` next to the existing Clock/Users badges:
   ```
   [🔥 ~520 kcal / serving]
   ```
   Uses a `Flame` icon from lucide-react. Hidden if value is null.

2. **`MealSlot`** (the meal-row card on the plan view) — add a small inline meta item next to the cook-time/servings line:
   ```
   🔥 ~520 kcal
   ```
   Only shown when `meal.recipe_card?.estimated_calories_per_serving` exists. Same gating as cook time (only on finalised plans / meals with URLs / library meals).

Calories scale **linearly** is unnecessary — value is "per serving" so it's display-as-is regardless of `currentServings`.

### 2f. Type updates

`src/types/meal.ts` — add `estimated_calories_per_serving: number | null` to the `RecipeCard` interface. Supabase generated types update automatically after the migration.

## Technical notes

- **Cost**: Flash-lite for calorie estimation is ~10x cheaper than Flash. One call per recipe card lifetime (cached).
- **No client-side prompts** — all in the edge function.
- **`config.toml`**: register the new `estimate-calories` function with `verify_jwt = false` (function validates auth in code, matching project pattern).
- No breaking changes to existing schemas / output contracts.
