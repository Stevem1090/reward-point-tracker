CREATE OR REPLACE FUNCTION public.check_freezer_reminders()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  flag RECORD; meal_date DATE; reminder_time TIMESTAMPTZ; day_offset INT; ikey text;
BEGIN
  SELECT value INTO ikey FROM internal_settings WHERE key = 'push_internal_key';
  FOR flag IN
    SELECT ff.id AS flag_id, ff.user_id, m.meal_name, m.day_of_week, mp.week_start_date
    FROM freezer_flags ff
    JOIN meals m ON ff.meal_id = m.id
    JOIN meal_plans mp ON m.meal_plan_id = mp.id
    WHERE ff.reminder_sent = false AND mp.status = 'approved'
  LOOP
    day_offset := CASE flag.day_of_week
      WHEN 'Monday' THEN 0 WHEN 'Tuesday' THEN 1 WHEN 'Wednesday' THEN 2 WHEN 'Thursday' THEN 3
      WHEN 'Friday' THEN 4 WHEN 'Saturday' THEN 5 WHEN 'Sunday' THEN 6 ELSE 0 END;
    meal_date := flag.week_start_date + day_offset;
    reminder_time := (meal_date - INTERVAL '1 day') + INTERVAL '18 hours';
    IF CURRENT_TIMESTAMP >= reminder_time AND CURRENT_TIMESTAMP < reminder_time + INTERVAL '1 minute' THEN
      BEGIN
        PERFORM net.http_post(
          url := 'https://ehhycpszdjhdqsorriun.supabase.co/functions/v1/send-push-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaHljcHN6ZGpoZHFzb3JyaXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMzQwNzQsImV4cCI6MjA1OTgxMDA3NH0.UH3VJFRZMPJC7WNsJtPf6wJrfp1KwuppoKkGHS9uSJQ',
            'X-Source', 'server',
            'X-Internal-Key', ikey),
          body := jsonb_build_object(
            'userIds', ARRAY[flag.user_id],
            'title', '❄️ Defrost Reminder',
            'body', 'Take out the ' || flag.meal_name || ' for tomorrow!',
            'kind', 'freezer',
            'itemId', flag.flag_id));
        UPDATE freezer_flags SET reminder_sent = true WHERE id = flag.flag_id;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO reminder_logs (level, message)
        VALUES ('ERROR', 'Failed to send defrost reminder for ' || flag.meal_name || ': ' || SQLERRM);
      END;
    END IF;
  END LOOP;
END;
$function$;