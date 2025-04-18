
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
    
    -- Log function execution start
    INSERT INTO reminder_logs (level, message)
    VALUES ('INFO', 'Starting check_and_send_reminders at ' || curr_time || ' on ' || curr_day);
    
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
        
        -- Log found reminder
        INSERT INTO reminder_logs (level, message)
        VALUES ('INFO', 'Found reminder to send: ' || reminder.title || ' at ' || reminder.time || ' for ' || array_to_string(reminder.days, ', '));
        
        -- Use owner_ids directly from reminder_owners
        IF array_length(reminder.owner_ids, 1) > 0 THEN
            target_users := reminder.owner_ids;
            
            -- Log target users
            INSERT INTO reminder_logs (level, message)
            VALUES ('INFO', 'Sending to specific users: ' || array_to_string(target_users, ', '));
            
            RAISE NOTICE 'Sending to specific users: %', target_users;
        ELSE
            -- Get all users with push subscriptions if no specific owners
            SELECT ARRAY_AGG(DISTINCT user_id)
            INTO target_users
            FROM user_push_subscriptions;
            
            -- Log all users
            INSERT INTO reminder_logs (level, message)
            VALUES ('INFO', 'Sending to all subscribed users: ' || COALESCE(array_to_string(target_users, ', '), 'none'));
            
            RAISE NOTICE 'Sending to all subscribed users: %', target_users;
        END IF;
        
        -- Skip if no target users
        IF target_users IS NULL OR array_length(target_users, 1) = 0 THEN
            RAISE NOTICE 'No target users for reminder: %', reminder.title;
            
            -- Log no target users
            INSERT INTO reminder_logs (level, message)
            VALUES ('WARNING', 'No target users for reminder: ' || reminder.title);
            
            CONTINUE;
        END IF;
        
        -- Call the push notification function
        BEGIN
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
            
            -- Log the response
            INSERT INTO reminder_logs (level, message)
            VALUES ('DEBUG', 'Push notification response status: ' || COALESCE(response.status::text, 'Unknown') || 
                            ', Content: ' || COALESCE(substring(response.content::text, 1, 500), 'No content'));
            
            -- Check response
            IF response.status = 200 THEN
                RAISE NOTICE 'Successfully sent notification for reminder: %', reminder.title;
                
                -- Log success
                INSERT INTO reminder_logs (level, message)
                VALUES ('INFO', 'Successfully sent notification for reminder: ' || reminder.title);
                
                -- Record the notification
                INSERT INTO reminder_notifications (reminder_id, sent_to, title, body)
                VALUES (
                    reminder.id::text,
                    target_users,
                    reminder.title,
                    'Time for ' || reminder.title || '!'
                );
            ELSE
                -- Log the error
                INSERT INTO reminder_logs (level, message)
                VALUES (
                    'ERROR', 
                    'Failed to send notification for reminder: ' || reminder.title || 
                    '. Status: ' || COALESCE(response.status::text, 'Unknown') || 
                    '. Response: ' || COALESCE(substring(response.content::text, 1, 500), 'No content')
                );
                
                RAISE WARNING 'Failed to send notification for reminder: %. Status: %, Response: %', 
                          reminder.title, response.status, substring(response.content::text, 1, 500);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Log any exceptions during the HTTP request
            INSERT INTO reminder_logs (level, message)
            VALUES ('ERROR', 'Exception when sending notification for reminder: ' || reminder.title || 
                            '. Error: ' || SQLERRM);
            
            RAISE WARNING 'Exception when sending notification: %', SQLERRM;
        END;
    END LOOP;
    
    -- Log function execution end
    INSERT INTO reminder_logs (level, message)
    VALUES ('INFO', 'Completed check_and_send_reminders at ' || CURRENT_TIME::TIME);
END;
$function$;
