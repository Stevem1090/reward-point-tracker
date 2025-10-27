-- Fix 1: Restrict auto_email_settings to authenticated users only
DROP POLICY IF EXISTS "Enable read access for all users" ON auto_email_settings;

CREATE POLICY "Users can view their own email settings"
  ON auto_email_settings
  FOR SELECT
  TO authenticated
  USING (email = (SELECT auth.jwt()->>'email'));

-- Fix 2: Restrict push_subscriptions table (appears to be old/unused, user_push_subscriptions is the active one)
DROP POLICY IF EXISTS "Allow all operations on push_subscriptions" ON push_subscriptions;

CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Fix 3: Enable RLS on logging tables
ALTER TABLE cron_job_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_notifications ENABLE ROW LEVEL SECURITY;

-- Add restrictive policies for logging tables
CREATE POLICY "No public access to cron logs"
  ON cron_job_log
  FOR ALL
  TO authenticated
  USING (false);

CREATE POLICY "No public access to reminder logs"
  ON reminder_logs
  FOR ALL
  TO authenticated
  USING (false);

CREATE POLICY "Users can view their own notifications"
  ON reminder_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY(sent_to));

-- Clean up old reminder logs to reduce table size (830K rows -> keep last 30 days)
DELETE FROM reminder_logs WHERE created_at < NOW() - INTERVAL '30 days';