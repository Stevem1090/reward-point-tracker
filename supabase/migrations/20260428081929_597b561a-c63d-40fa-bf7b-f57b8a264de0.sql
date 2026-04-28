
CREATE TABLE public.chore_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#8B5CF6',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chore_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chore categories"
  ON public.chore_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own chore categories"
  ON public.chore_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own chore categories"
  ON public.chore_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chore categories"
  ON public.chore_categories FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.chores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.chore_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly','monthly','adhoc')),
  completed_at timestamptz,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chores"
  ON public.chores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own chores"
  ON public.chores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own chores"
  ON public.chores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chores"
  ON public.chores FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_chores_user_category ON public.chores(user_id, category_id);

CREATE TABLE public.chore_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id uuid NOT NULL REFERENCES public.chores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chore_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chore completions"
  ON public.chore_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own chore completions"
  ON public.chore_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chore completions"
  ON public.chore_completions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_chore_completions_chore_time ON public.chore_completions(chore_id, completed_at);
