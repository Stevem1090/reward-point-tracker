CREATE TABLE public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push tokens" ON public.push_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.task_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_sections TO authenticated;
GRANT ALL ON public.task_sections TO service_role;
ALTER TABLE public.task_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users manage sections" ON public.task_sections FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.task_sections(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  due_at timestamptz,
  is_private boolean NOT NULL DEFAULT false,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  sort_order integer NOT NULL DEFAULT 0,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View shared or own tasks" ON public.tasks FOR SELECT TO authenticated
  USING (is_private = false OR owner_id = auth.uid());
CREATE POLICY "Create own tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Edit shared or own tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (is_private = false OR owner_id = auth.uid())
  WITH CHECK (is_private = false OR owner_id = auth.uid());
CREATE POLICY "Delete shared or own tasks" ON public.tasks FOR DELETE TO authenticated
  USING (is_private = false OR owner_id = auth.uid());
CREATE INDEX tasks_due_idx ON public.tasks (due_at) WHERE done = false AND notified_at IS NULL;

CREATE OR REPLACE FUNCTION public.tasks_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN NEW.notified_at = NULL; END IF;
  IF NEW.done AND NOT OLD.done THEN NEW.done_at = now(); END IF;
  IF NOT NEW.done THEN NEW.done_at = NULL; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tasks_before_update BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_before_update();

INSERT INTO public.task_sections (name, sort_order) VALUES ('Today',0),('Soon',1),('Later',2);