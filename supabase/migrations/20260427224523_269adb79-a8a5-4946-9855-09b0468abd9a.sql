ALTER TABLE public.recipe_cards
  ADD COLUMN IF NOT EXISTS estimated_calories_per_serving INTEGER;