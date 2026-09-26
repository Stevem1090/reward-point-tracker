ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS repeat_interval smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS repeat_days smallint[],
  ADD COLUMN IF NOT EXISTS repeat_month_days smallint[];

UPDATE public.tasks SET repeat_days = ARRAY[repeat_weekday]::smallint[]
 WHERE repeat = 'weekly' AND repeat_weekday IS NOT NULL AND repeat_days IS NULL;
UPDATE public.tasks SET repeat_month_days = ARRAY[repeat_day]::smallint[]
 WHERE repeat = 'monthly' AND repeat_day IS NOT NULL AND repeat_month_days IS NULL;

DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.tasks'::regclass AND contype = 'c' AND conname LIKE '%repeat%'
  LOOP EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT %I', c); END LOOP;
END $$;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_repeat_check CHECK (repeat IN ('none','daily','weekly','monthly','yearly')),
  ADD CONSTRAINT tasks_repeat_interval_check CHECK (repeat_interval BETWEEN 1 AND 60);

CREATE OR REPLACE FUNCTION public.task_next_occurrence_v2(
  _after timestamptz, _due timestamptz, _repeat text,
  _interval int, _days smallint[], _month_days smallint[]
) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $$
DECLARE
  d date := (_after AT TIME ZONE 'Europe/London')::date;
  t time := COALESCE((_due AT TIME ZONE 'Europe/London')::time, '09:00');
  iv int := GREATEST(COALESCE(_interval, 1), 1);
  days smallint[];
  mdays smallint[];
  n date;
  cand date;
  ws_d date; ws_c date;
  i int; x int; dim int; m2 date;
BEGIN
  IF _repeat = 'daily' THEN
    n := d + iv;
  ELSIF _repeat = 'weekly' THEN
    days := COALESCE(NULLIF(_days, '{}'::smallint[]), ARRAY[extract(dow FROM d)::smallint]);
    n := NULL;
    FOR i IN 1..7 LOOP
      cand := d + i;
      IF extract(dow FROM cand)::smallint = ANY(days) THEN
        ws_d := d - (extract(isodow FROM d)::int - 1);
        ws_c := cand - (extract(isodow FROM cand)::int - 1);
        IF ws_c > ws_d THEN cand := cand + (iv - 1) * 7; END IF;
        n := cand;
        EXIT;
      END IF;
    END LOOP;
    IF n IS NULL THEN n := d + iv * 7; END IF;
  ELSIF _repeat = 'monthly' THEN
    mdays := COALESCE(NULLIF(_month_days, '{}'::smallint[]), ARRAY[extract(day FROM d)::smallint]);
    dim := extract(day FROM (date_trunc('month', d) + interval '1 month' - interval '1 day'))::int;
    n := NULL;
    SELECT min(date_trunc('month', d)::date + (LEAST(v, dim) - 1)) INTO cand
      FROM unnest(mdays) AS v
     WHERE date_trunc('month', d)::date + (LEAST(v, dim) - 1) > d;
    IF cand IS NOT NULL THEN
      n := cand;
    ELSE
      m2 := (date_trunc('month', d) + make_interval(months => iv))::date;
      dim := extract(day FROM (m2 + interval '1 month' - interval '1 day'))::int;
      SELECT min(LEAST(v, dim)) INTO x FROM unnest(mdays) AS v;
      n := m2 + (COALESCE(x, 1) - 1);
    END IF;
  ELSIF _repeat = 'yearly' THEN
    n := (d + make_interval(years => iv))::date;
  ELSE
    RETURN NULL;
  END IF;
  RETURN (n + t) AT TIME ZONE 'Europe/London';
END $$;

CREATE OR REPLACE FUNCTION public.roll_recurring_tasks()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE today date := (now() AT TIME ZONE 'Europe/London')::date;
BEGIN
  UPDATE tasks
  SET due_at = task_next_occurrence_v2(due_at, due_at, repeat, repeat_interval, repeat_days, repeat_month_days),
      done = false,
      done_at = NULL,
      notified_at = NULL
  WHERE repeat <> 'none'
    AND due_at IS NOT NULL
    AND (done OR notified_at IS NOT NULL)
    AND (task_next_occurrence_v2(due_at, due_at, repeat, repeat_interval, repeat_days, repeat_month_days) AT TIME ZONE 'Europe/London')::date <= today;
END $$;

REVOKE ALL ON FUNCTION public.roll_recurring_tasks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roll_recurring_tasks() TO service_role;