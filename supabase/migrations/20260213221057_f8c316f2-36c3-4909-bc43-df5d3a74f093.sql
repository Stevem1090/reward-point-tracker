
CREATE OR REPLACE FUNCTION public.check_and_send_reminders()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    curr_time TIME;
    curr_day TEXT;
    reminder RECORD;
    target_users UUID[];
    reminder_count INT;
BEGIN
    BEGIN
        curr_time := date_trunc('minute', CURRENT_TIMESTAMP)::TIME;
        curr_day := to_char(CURRENT_DATE, 'FMDay');

        INSERT INTO reminder_logs (level, message)
        VALUES ('INFO', 'Starting check_and_send_reminders at ' || curr_time || ' on ' || curr_day);

        SELECT COUNT(*) INTO reminder_count
        FROM reminders r
        LEFT JOIN reminder_owners ro ON r.id = ro.reminder_id
        WHERE r.active = true
          AND date_trunc('minute', r.time)::TIME = curr_time
          AND curr_day = ANY(r.days);

        INSERT INTO reminder_logs (level, message)
        VALUES ('DEBUG', 'Found ' || reminder_count || ' reminders scheduled at ' || curr_time || ' on ' || curr_day);

        IF reminder_count = 0 THEN
            INSERT INTO reminder_logs (level, message)
            VALUES ('INFO', 'No matching reminders to send at this time.');
            RETURN;
        END IF;

        FOR reminder IN
            SELECT r.*, ARRAY_AGG(DISTINCT ro.owner_id) AS owner_ids
            FROM reminders r
            LEFT JOIN reminder_owners ro ON r.id = ro.reminder_id
            WHERE r.active = true
              AND date_trunc('minute', r.time)::TIME = curr_time
              AND curr_day = ANY(r.days)
            GROUP BY r.id
        LOOP
            INSERT INTO reminder_logs (level, message)
            VALUES ('INFO', 'Preparing to send reminder: ' || reminder.title || ' (ID: ' || reminder.id || ')');

            IF array_length(reminder.owner_ids, 1) > 0 THEN
                target_users := reminder.owner_ids;
                INSERT INTO reminder_logs (level, message)
                VALUES ('INFO', 'Sending to specific users: ' || array_to_string(target_users, ', '));
            ELSE
                SELECT ARRAY_AGG(DISTINCT user_id)
                INTO target_users
                FROM user_push_subscriptions;

                INSERT INTO reminder_logs (level, message)
                VALUES ('INFO', 'Sending to all subscribed users: ' || COALESCE(array_to_string(target_users, ', '), 'none'));
            END IF;

            IF target_users IS NULL OR array_length(target_users, 1) = 0 THEN
                INSERT INTO reminder_logs (level, message)
                VALUES ('WARNING', 'No target users for reminder: ' || reminder.title || ' (ID: ' || reminder.id || ')');
                CONTINUE;
            END IF;

            BEGIN
                INSERT INTO reminder_logs (level, message)
                VALUES ('INFO', 'Calling push function for reminder ID ' || reminder.id);

                PERFORM net.http_post(
                    url := 'https://ehhycpszdjhdqsorriun.supabase.co/functions/v1/send-push-notification',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaHljcHN6ZGpoZHFzb3JyaXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMzQwNzQsImV4cCI6MjA1OTgxMDA3NH0.UH3VJFRZMPJC7WNsJtPf6wJrfp1KwuppoKkGHS9uSJQ',
                        'X-Source', 'server'
                    ),
                    body := jsonb_build_object(
                        'userIds', target_users,
                        'title', reminder.title,
                        'body', 'Time for ' || reminder.title || '!'
                    )
                );

                INSERT INTO reminder_logs (level, message)
                VALUES ('INFO', 'Push request sent for reminder ID ' || reminder.id);

            EXCEPTION WHEN OTHERS THEN
                INSERT INTO reminder_logs (level, message)
                VALUES ('ERROR', 'Exception sending push request for reminder ID ' || reminder.id || ': ' || SQLERRM);
            END;
        END LOOP;

        INSERT INTO reminder_logs (level, message)
        VALUES ('INFO', 'Completed check_and_send_reminders at ' || CURRENT_TIME::TIME);

    EXCEPTION WHEN OTHERS THEN
        INSERT INTO reminder_logs (level, message)
        VALUES ('CRITICAL', 'Function failed entirely: ' || SQLERRM);
    END;
END;
$function$;

-- Reset freezer flags for re-testing
UPDATE freezer_flags SET reminder_sent = false;
