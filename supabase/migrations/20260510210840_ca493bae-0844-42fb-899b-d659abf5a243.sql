
-- Healthy extra enum
CREATE TYPE public.sw_healthy_extra_type AS ENUM ('calcium', 'fibre', 'healthy_fats');

-- sw_foods
CREATE TABLE public.sw_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  weight text,
  swips numeric NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  healthy_extra_type sw_healthy_extra_type,
  healthy_extra_amount numeric NOT NULL DEFAULT 0,
  is_speed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sw_foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sw_foods select own" ON public.sw_foods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sw_foods insert own" ON public.sw_foods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sw_foods update own" ON public.sw_foods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sw_foods delete own" ON public.sw_foods FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_sw_foods_updated BEFORE UPDATE ON public.sw_foods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- sw_meals
CREATE TABLE public.sw_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sw_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sw_meals select own" ON public.sw_meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sw_meals insert own" ON public.sw_meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sw_meals update own" ON public.sw_meals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sw_meals delete own" ON public.sw_meals FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_sw_meals_updated BEFORE UPDATE ON public.sw_meals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- sw_meal_items
CREATE TABLE public.sw_meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES public.sw_meals(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES public.sw_foods(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sw_meal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sw_meal_items select own" ON public.sw_meal_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.sw_meals m WHERE m.id = meal_id AND m.user_id = auth.uid()));
CREATE POLICY "sw_meal_items insert own" ON public.sw_meal_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.sw_meals m WHERE m.id = meal_id AND m.user_id = auth.uid()));
CREATE POLICY "sw_meal_items update own" ON public.sw_meal_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.sw_meals m WHERE m.id = meal_id AND m.user_id = auth.uid()));
CREATE POLICY "sw_meal_items delete own" ON public.sw_meal_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.sw_meals m WHERE m.id = meal_id AND m.user_id = auth.uid()));

-- sw_log_entries
CREATE TABLE public.sw_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  entry_type text NOT NULL CHECK (entry_type IN ('food','meal','recipe')),
  food_id uuid REFERENCES public.sw_foods(id) ON DELETE SET NULL,
  meal_id uuid REFERENCES public.sw_meals(id) ON DELETE SET NULL,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  swips_snapshot numeric NOT NULL DEFAULT 0,
  healthy_extra_type_snapshot sw_healthy_extra_type,
  healthy_extra_amount_snapshot numeric NOT NULL DEFAULT 0,
  is_speed_snapshot boolean NOT NULL DEFAULT false,
  quantity numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sw_log_entries_user_date_idx ON public.sw_log_entries(user_id, log_date);
ALTER TABLE public.sw_log_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sw_log select own" ON public.sw_log_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sw_log insert own" ON public.sw_log_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sw_log update own" ON public.sw_log_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sw_log delete own" ON public.sw_log_entries FOR DELETE USING (auth.uid() = user_id);

-- Optional SW fields on recipes and meals
ALTER TABLE public.recipes
  ADD COLUMN sw_swips numeric,
  ADD COLUMN sw_healthy_extra_type sw_healthy_extra_type,
  ADD COLUMN sw_healthy_extra_amount numeric,
  ADD COLUMN sw_is_speed boolean;

ALTER TABLE public.meals
  ADD COLUMN sw_swips numeric,
  ADD COLUMN sw_healthy_extra_type sw_healthy_extra_type,
  ADD COLUMN sw_healthy_extra_amount numeric,
  ADD COLUMN sw_is_speed boolean;
