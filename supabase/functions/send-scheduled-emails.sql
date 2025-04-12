
CREATE OR REPLACE FUNCTION public.send_scheduled_emails()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  settings_record RECORD;
  today DATE := CURRENT_DATE;
  summary_html TEXT;
  email_domain TEXT;
  response RECORD;
BEGIN
  -- Loop through all enabled auto-send settings where email hasn't been sent today
  FOR settings_record IN 
    SELECT * FROM auto_email_settings 
    WHERE auto_send_enabled = true 
    AND (last_sent_date IS NULL OR last_sent_date < today)
  LOOP
    -- Generate summary HTML for today
    summary_html := get_points_summary_html(today);
    
    -- Check if there are any entries for today
    IF summary_html NOT LIKE '%<ul>%' THEN
      -- No entries for today, skip sending email
      CONTINUE;
    END IF;
    
    -- Extract domain for logging
    email_domain := split_part(settings_record.email, '@', 2);
    RAISE NOTICE 'Sending email to % (domain: %)', settings_record.email, email_domain;
    
    -- Call the Edge Function to send the email
    SELECT * INTO response FROM net.http_post(
      url := 'https://ehhycpszdjhdqsorriun.supabase.co/functions/v1/send-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json', 
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaHljcHN6ZGpoZHFzb3JyaXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMzQwNzQsImV4cCI6MjA1OTgxMDA3NH0.UH3VJFRZMPJC7WNsJtPf6wJrfp1KwuppoKkGHS9uSJQ',
        'X-Source', 'server'
      ),
      body := jsonb_build_object(
        'email', settings_record.email,
        'subject', 'Daily Points Summary for ' || today,
        'content', summary_html
      )
    );
    
    -- Check response for success
    IF response.status = 200 THEN
      -- Update the last sent date
      UPDATE auto_email_settings 
      SET last_sent_date = today
      WHERE id = settings_record.id;
      
      RAISE NOTICE 'Successfully sent email to %', settings_record.email;
    ELSE
      RAISE WARNING 'Failed to send email to % (domain: %). Status: %, Response: %', 
                 settings_record.email, email_domain, response.status, response.content;
    END IF;
  END LOOP;
END;
$function$;
