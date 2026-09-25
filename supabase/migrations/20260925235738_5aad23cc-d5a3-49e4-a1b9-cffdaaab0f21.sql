CREATE OR REPLACE FUNCTION public.check_and_send_reminders()
 RETURNS void LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE curr_time TIME; curr_day TEXT; reminder RECORD; target_users UUID[];
BEGIN
  curr_time := date_trunc('minute', (now() AT TIME ZONE 'Europe/London'))::TIME;
  curr_day := to_char((now() AT TIME ZONE 'Europe/London')::date, 'FMDay');
  FOR reminder IN
    SELECT r.*, ARRAY_AGG(DISTINCT ro.owner_id) FILTER (WHERE ro.owner_id IS NOT NULL) AS owner_ids
    FROM reminders r LEFT JOIN reminder_owners ro ON r.id = ro.reminder_id
    WHERE r.active AND date_trunc('minute', r.time)::TIME = curr_time AND curr_day = ANY(r.days)
    GROUP BY r.id
  LOOP
    IF reminder.owner_ids IS NOT NULL AND array_length(reminder.owner_ids,1) > 0 THEN
      target_users := reminder.owner_ids;
    ELSE
      SELECT ARRAY_AGG(user_id) INTO target_users FROM family_members WHERE family_id = reminder.family_id;
    END IF;
    IF target_users IS NULL THEN CONTINUE; END IF;
    BEGIN
      PERFORM net.http_post(
        url := 'https://ehhycpszdjhdqsorriun.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaHljcHN6ZGpoZHFzb3JyaXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMzQwNzQsImV4cCI6MjA1OTgxMDA3NH0.UH3VJFRZMPJC7WNsJtPf6wJrfp1KwuppoKkGHS9uSJQ','X-Source','server'),
        body := jsonb_build_object('userIds', target_users, 'title', reminder.title, 'body', 'Time for ' || reminder.title || '!'));
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO reminder_logs (level, message) VALUES ('ERROR', 'Reminder ' || reminder.id || ': ' || SQLERRM);
    END;
  END LOOP;
END $function$;