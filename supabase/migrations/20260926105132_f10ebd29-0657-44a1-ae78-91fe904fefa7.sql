ALTER TABLE public.tasks
  ADD COLUMN assigned_to uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON public.tasks (assigned_to);