-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create recipes table (User's Recipe Library)
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('website', 'cookbook')),
  recipe_url TEXT,
  cookbook_title TEXT,
  image_url TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  servings INTEGER NOT NULL DEFAULT 4,
  estimated_cook_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create meal_plans table
CREATE TABLE public.meal_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  week_start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  UNIQUE(user_id, week_start_date)
);

-- Create meals table
CREATE TABLE public.meals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_plan_id UUID REFERENCES public.meal_plans ON DELETE CASCADE NOT NULL,
  recipe_id UUID REFERENCES public.recipes ON DELETE SET NULL,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  meal_name TEXT NOT NULL,
  description TEXT,
  recipe_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'ai_generated' CHECK (source_type IN ('ai_generated', 'user_library', 'user_custom')),
  servings INTEGER NOT NULL DEFAULT 4,
  estimated_cook_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create recipe_cards table (Generated on Approval)
CREATE TABLE public.recipe_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id UUID REFERENCES public.meals ON DELETE CASCADE NOT NULL UNIQUE,
  meal_name TEXT NOT NULL,
  image_url TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_servings INTEGER NOT NULL DEFAULT 4,
  html_content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create shopping_lists table
CREATE TABLE public.shopping_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  meal_plan_id UUID REFERENCES public.meal_plans ON DELETE CASCADE NOT NULL UNIQUE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create meal_ratings table
CREATE TABLE public.meal_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id UUID REFERENCES public.meals ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meal_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recipes
CREATE POLICY "Users can view their own recipes" ON public.recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own recipes" ON public.recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recipes" ON public.recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recipes" ON public.recipes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for meal_plans
CREATE POLICY "Users can view their own meal plans" ON public.meal_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own meal plans" ON public.meal_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own meal plans" ON public.meal_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own meal plans" ON public.meal_plans FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for meals (via meal_plan ownership)
CREATE POLICY "Users can view meals in their plans" ON public.meals FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meals.meal_plan_id AND meal_plans.user_id = auth.uid()));
CREATE POLICY "Users can create meals in their plans" ON public.meals FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meals.meal_plan_id AND meal_plans.user_id = auth.uid()));
CREATE POLICY "Users can update meals in their plans" ON public.meals FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meals.meal_plan_id AND meal_plans.user_id = auth.uid()));
CREATE POLICY "Users can delete meals in their plans" ON public.meals FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meals.meal_plan_id AND meal_plans.user_id = auth.uid()));

-- RLS Policies for recipe_cards (via meal ownership)
CREATE POLICY "Users can view recipe cards in their meals" ON public.recipe_cards FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.meals 
    JOIN public.meal_plans ON meal_plans.id = meals.meal_plan_id 
    WHERE meals.id = recipe_cards.meal_id AND meal_plans.user_id = auth.uid()
  ));
CREATE POLICY "Users can create recipe cards in their meals" ON public.recipe_cards FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.meals 
    JOIN public.meal_plans ON meal_plans.id = meals.meal_plan_id 
    WHERE meals.id = recipe_cards.meal_id AND meal_plans.user_id = auth.uid()
  ));
CREATE POLICY "Users can update recipe cards in their meals" ON public.recipe_cards FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.meals 
    JOIN public.meal_plans ON meal_plans.id = meals.meal_plan_id 
    WHERE meals.id = recipe_cards.meal_id AND meal_plans.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete recipe cards in their meals" ON public.recipe_cards FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.meals 
    JOIN public.meal_plans ON meal_plans.id = meals.meal_plan_id 
    WHERE meals.id = recipe_cards.meal_id AND meal_plans.user_id = auth.uid()
  ));

-- RLS Policies for shopping_lists
CREATE POLICY "Users can view their own shopping lists" ON public.shopping_lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own shopping lists" ON public.shopping_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own shopping lists" ON public.shopping_lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own shopping lists" ON public.shopping_lists FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for meal_ratings
CREATE POLICY "Users can view their own ratings" ON public.meal_ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own ratings" ON public.meal_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ratings" ON public.meal_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own ratings" ON public.meal_ratings FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_recipes_user_id ON public.recipes(user_id);
CREATE INDEX idx_meal_plans_user_id ON public.meal_plans(user_id);
CREATE INDEX idx_meal_plans_week_start ON public.meal_plans(week_start_date);
CREATE INDEX idx_meals_meal_plan_id ON public.meals(meal_plan_id);
CREATE INDEX idx_meals_day_of_week ON public.meals(day_of_week);
CREATE INDEX idx_recipe_cards_meal_id ON public.recipe_cards(meal_id);
CREATE INDEX idx_shopping_lists_meal_plan_id ON public.shopping_lists(meal_plan_id);
CREATE INDEX idx_meal_ratings_meal_id ON public.meal_ratings(meal_id);

-- Create updated_at triggers
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meals_updated_at BEFORE UPDATE ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shopping_lists_updated_at BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for recipe images
INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for recipe-images bucket
CREATE POLICY "Recipe images are publicly accessible" ON storage.objects 
  FOR SELECT USING (bucket_id = 'recipe-images');

CREATE POLICY "Users can upload recipe images" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'recipe-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their recipe images" ON storage.objects 
  FOR UPDATE USING (bucket_id = 'recipe-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their recipe images" ON storage.objects 
  FOR DELETE USING (bucket_id = 'recipe-images' AND auth.uid() IS NOT NULL);