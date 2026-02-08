
-- Create freezer_flags table
CREATE TABLE public.freezer_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.freezer_flags ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own freezer flags"
  ON public.freezer_flags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own freezer flags"
  ON public.freezer_flags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own freezer flags"
  ON public.freezer_flags FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own freezer flags"
  ON public.freezer_flags FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for fast lookups by meal_id
CREATE INDEX idx_freezer_flags_meal_id ON public.freezer_flags(meal_id);
CREATE INDEX idx_freezer_flags_user_id ON public.freezer_flags(user_id);
