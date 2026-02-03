-- Create family_preferences table to store learned preferences from meal ratings
CREATE TABLE public.family_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  preference_type TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence NUMERIC DEFAULT 1.0,
  evidence_count INTEGER DEFAULT 1,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, preference_type, value)
);

-- Enable RLS
ALTER TABLE public.family_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own preferences
CREATE POLICY "Users can view own preferences" ON public.family_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.family_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.family_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences" ON public.family_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE public.family_preferences IS 'Stores learned family preferences from meal ratings for AI personalization';