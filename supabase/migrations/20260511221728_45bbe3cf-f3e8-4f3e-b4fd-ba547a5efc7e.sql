
-- 1. Add recipe_id to meal_ratings and backfill from meals
ALTER TABLE public.meal_ratings ADD COLUMN IF NOT EXISTS recipe_id uuid;
CREATE INDEX IF NOT EXISTS idx_meal_ratings_recipe_id ON public.meal_ratings(recipe_id);

UPDATE public.meal_ratings r
SET recipe_id = m.recipe_id
FROM public.meals m
WHERE m.id = r.meal_id
  AND m.recipe_id IS NOT NULL
  AND r.recipe_id IS NULL;

-- 2. Deduplicate recipes by case-insensitive trimmed name.
-- Winner = most ingredients, then most-recent updated_at. Reassign meals.recipe_id
-- to the winner before deleting losers.
WITH ranked AS (
  SELECT
    id,
    lower(trim(name)) AS key,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(name))
      ORDER BY jsonb_array_length(COALESCE(ingredients, '[]'::jsonb)) DESC,
               updated_at DESC
    ) AS rn
  FROM public.recipes
),
winners AS (
  SELECT key, id AS winner_id FROM ranked WHERE rn = 1
),
losers AS (
  SELECT r.id AS loser_id, w.winner_id
  FROM ranked r
  JOIN winners w ON r.key = w.key
  WHERE r.rn > 1
)
UPDATE public.meals m
SET recipe_id = l.winner_id
FROM losers l
WHERE m.recipe_id = l.loser_id;

-- Also reassign meal_ratings.recipe_id from losers to winners
WITH ranked AS (
  SELECT
    id,
    lower(trim(name)) AS key,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(name))
      ORDER BY jsonb_array_length(COALESCE(ingredients, '[]'::jsonb)) DESC,
               updated_at DESC
    ) AS rn
  FROM public.recipes
),
winners AS (
  SELECT key, id AS winner_id FROM ranked WHERE rn = 1
),
losers AS (
  SELECT r.id AS loser_id, w.winner_id
  FROM ranked r
  JOIN winners w ON r.key = w.key
  WHERE r.rn > 1
)
UPDATE public.meal_ratings mr
SET recipe_id = l.winner_id
FROM losers l
WHERE mr.recipe_id = l.loser_id;

-- Delete loser recipes
WITH ranked AS (
  SELECT
    id,
    lower(trim(name)) AS key,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(name))
      ORDER BY jsonb_array_length(COALESCE(ingredients, '[]'::jsonb)) DESC,
               updated_at DESC
    ) AS rn
  FROM public.recipes
)
DELETE FROM public.recipes
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3. Detach any meals still pointing at empty recipes (so the AI can regenerate)
UPDATE public.meals
SET recipe_id = NULL
WHERE recipe_id IN (
  SELECT id FROM public.recipes
  WHERE jsonb_array_length(COALESCE(ingredients, '[]'::jsonb)) = 0
    AND jsonb_array_length(COALESCE(steps, '[]'::jsonb)) = 0
);

-- 4. Delete empty recipes (no ingredients AND no steps)
DELETE FROM public.recipes
WHERE jsonb_array_length(COALESCE(ingredients, '[]'::jsonb)) = 0
  AND jsonb_array_length(COALESCE(steps, '[]'::jsonb)) = 0;
