CREATE OR REPLACE FUNCTION public.tasks_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  -- Repeating tasks keep their current due date when ticked; roll_recurring_tasks()
  -- moves them on once the next occurrence day arrives.
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN NEW.notified_at = NULL; END IF;
  IF NEW.done AND NOT OLD.done THEN NEW.done_at = now(); END IF;
  IF NOT NEW.done THEN NEW.done_at = NULL; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.roll_recurring_tasks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE today date := (now() AT TIME ZONE 'Europe/London')::date;
BEGIN
  -- Once the next occurrence day has arrived, move the task on and reset it
  UPDATE tasks
  SET due_at = task_next_occurrence(due_at, due_at, repeat, repeat_weekday, repeat_day),
      done = false,
      done_at = NULL,
      notified_at = NULL
  WHERE repeat <> 'none'
    AND due_at IS NOT NULL
    AND (done OR notified_at IS NOT NULL)
    AND (task_next_occurrence(due_at, due_at, repeat, repeat_weekday, repeat_day) AT TIME ZONE 'Europe/London')::date <= today;
END $$;

REVOKE ALL ON FUNCTION public.roll_recurring_tasks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roll_recurring_tasks() TO service_role;