ALTER TABLE public.tasks
  ADD COLUMN repeat text NOT NULL DEFAULT 'none' CHECK (repeat IN ('none','daily','weekly','monthly')),
  ADD COLUMN repeat_weekday smallint CHECK (repeat_weekday BETWEEN 0 AND 6),
  ADD COLUMN repeat_day smallint CHECK (repeat_day BETWEEN 1 AND 31);

CREATE OR REPLACE FUNCTION public.task_next_occurrence(_after timestamptz, _due timestamptz, _repeat text, _weekday smallint, _day smallint)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d date := (_after AT TIME ZONE 'Europe/London')::date;
  t time := COALESCE((_due AT TIME ZONE 'Europe/London')::time, '09:00');
  n date; m date; diff int;
BEGIN
  IF _repeat = 'daily' THEN n := d + 1;
  ELSIF _repeat = 'weekly' THEN
    diff := (COALESCE(_weekday, extract(dow FROM d)::int) - extract(dow FROM d)::int + 7) % 7;
    IF diff = 0 THEN diff := 7; END IF;
    n := d + diff;
  ELSIF _repeat = 'monthly' THEN
    m := date_trunc('month', d)::date;
    n := m + (LEAST(COALESCE(_day, extract(day FROM d)::int), extract(day FROM (m + interval '1 month' - interval '1 day'))::int) - 1);
    IF n <= d THEN
      m := (m + interval '1 month')::date;
      n := m + (LEAST(COALESCE(_day, extract(day FROM d)::int), extract(day FROM (m + interval '1 month' - interval '1 day'))::int) - 1);
    END IF;
  ELSE RETURN NULL;
  END IF;
  RETURN (n + t) AT TIME ZONE 'Europe/London';
END $$;

CREATE OR REPLACE FUNCTION public.tasks_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.done AND NOT OLD.done AND NEW.repeat <> 'none' THEN
    NEW.due_at = task_next_occurrence(GREATEST(COALESCE(OLD.due_at, now()), now()), OLD.due_at, NEW.repeat, NEW.repeat_weekday, NEW.repeat_day);
  END IF;
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN NEW.notified_at = NULL; END IF;
  IF NEW.done AND NOT OLD.done THEN NEW.done_at = now(); END IF;
  IF NOT NEW.done THEN NEW.done_at = NULL; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.roll_recurring_tasks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE today date := (now() AT TIME ZONE 'Europe/London')::date;
BEGIN
  -- Ticked repeating tasks come back on their next day
  UPDATE tasks SET done = false
  WHERE repeat <> 'none' AND done AND due_at IS NOT NULL
    AND (due_at AT TIME ZONE 'Europe/London')::date <= today;
  -- Missed repeating tasks move to the new date once it arrives
  UPDATE tasks SET due_at = task_next_occurrence(due_at, due_at, repeat, repeat_weekday, repeat_day)
  WHERE repeat <> 'none' AND NOT done AND due_at IS NOT NULL AND notified_at IS NOT NULL
    AND (task_next_occurrence(due_at, due_at, repeat, repeat_weekday, repeat_day) AT TIME ZONE 'Europe/London')::date <= today;
END $$;

REVOKE ALL ON FUNCTION public.roll_recurring_tasks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roll_recurring_tasks() TO service_role;