
CREATE OR REPLACE FUNCTION public.check_and_send_reminders()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    curr_time TIME;
    curr_day TEXT;
    reminder RECORD;
    target_users UUID[];
    response RECORD;
BEGIN
    curr_time := CURRENT_TIME::TIME;
    curr_day := trim(to_char(CURRENT_DATE, 'Day'));
    
    RAISE NOTICE 'Checking reminders at % on %', curr_time, curr_day;
    
    -- Loop through reminders that should be sent now
    FOR reminder IN 
        SELECT r.*, 
               ARRAY_AGG(DISTINCT ro.owner_id) as owner_ids
        FROM reminders r
        LEFT JOIN reminder_owners ro ON r.id = ro.reminder_id
        WHERE r.active = true 
        AND r.time::TIME = curr_time
        AND curr_day = ANY(r.days)
        GROUP BY r.id
    LOOP
        RAISE NOTICE 'Found reminder to send: % at % for %', reminder.title, reminder.time, reminder.days;
        
        -- Use owner_ids directly from reminder_owners
        IF array_length(reminder.owner_ids, 1) > 0 THEN
            target_users := reminder.owner_ids;
            RAISE NOTICE 'Sending to specific users: %', target_users;
        ELSE
            -- Get all users with push subscriptions if no specific owners
            SELECT ARRAY_AGG(DISTINCT user_id)
            INTO target_users
            FROM user_push_subscriptions;
            RAISE NOTICE 'Sending to all subscribed users: %', target_users;
        END IF;
        
        -- Skip if no target users
        IF target_users IS NULL OR array_length(target_users, 1) = 0 THEN
            RAISE NOTICE 'No target users for reminder: %', reminder.title;
            CONTINUE;
        END IF;
        
        -- Call the push notification function
        SELECT * INTO response FROM net.http_post(
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
        
        -- Check response
        IF response.status = 200 THEN
            RAISE NOTICE 'Successfully sent notification for reminder: %', reminder.title;
            
            -- Record the notification
            INSERT INTO reminder_notifications (reminder_id, sent_to, title, body)
            VALUES (
                reminder.id::text,
                target_users,
                reminder.title,
                'Time for ' || reminder.title || '!'
            );
        ELSE
            RAISE WARNING 'Failed to send notification for reminder: %. Status: %, Response: %', 
                      reminder.title, response.status, response.content;
        END IF;
    END LOOP;
END;
$function$;
