-- 1. Backfill meals.recipe_id from library by name+user
UPDATE meals m
SET recipe_id = r.id
FROM meal_plans mp, recipes r
WHERE m.meal_plan_id = mp.id
  AND m.recipe_id IS NULL
  AND r.user_id = mp.user_id
  AND lower(trim(r.name)) = lower(trim(m.meal_name));

-- 2. Backfill meal_ratings.recipe_id via meals
UPDATE meal_ratings mr
SET recipe_id = m.recipe_id
FROM meals m
WHERE mr.meal_id = m.id
  AND mr.recipe_id IS NULL
  AND m.recipe_id IS NOT NULL;

-- 3. Trigger to auto-link future meals by name
CREATE OR REPLACE FUNCTION public.auto_link_meal_recipe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_user uuid;
  matched_recipe uuid;
BEGIN
  IF NEW.recipe_id IS NOT NULL OR NEW.meal_name IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO plan_user FROM meal_plans WHERE id = NEW.meal_plan_id;
  IF plan_user IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO matched_recipe
  FROM recipes
  WHERE user_id = plan_user
    AND lower(trim(name)) = lower(trim(NEW.meal_name))
  LIMIT 1;

  IF matched_recipe IS NOT NULL THEN
    NEW.recipe_id := matched_recipe;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_meal_recipe ON meals;
CREATE TRIGGER trg_auto_link_meal_recipe
BEFORE INSERT OR UPDATE OF meal_name, recipe_id ON meals
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_meal_recipe();

-- 4. Trigger to keep meal_ratings.recipe_id in sync
CREATE OR REPLACE FUNCTION public.auto_link_rating_recipe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recipe_id IS NULL AND NEW.meal_id IS NOT NULL THEN
    SELECT recipe_id INTO NEW.recipe_id FROM meals WHERE id = NEW.meal_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_rating_recipe ON meal_ratings;
CREATE TRIGGER trg_auto_link_rating_recipe
BEFORE INSERT OR UPDATE ON meal_ratings
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_rating_recipe();