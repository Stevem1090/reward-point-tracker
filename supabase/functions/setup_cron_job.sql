
-- First, make sure the pg_cron extension is available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job that runs every minute to check for reminders
SELECT cron.schedule(
  'check-reminders-every-minute',
  '* * * * *',  -- Run every minute
  'SELECT check_and_send_reminders();'
);

-- For debugging, we can log when this job runs
SELECT cron.schedule(
  'log-cron-job-runs',
  '* * * * *',  -- Run every minute
  $$
  INSERT INTO cron_job_log (job_name, run_at)
  VALUES ('check-reminders-every-minute', now());
  $$
);

-- Create a table to log cron job runs if it doesn't exist
CREATE TABLE IF NOT EXISTS cron_job_log (
  id SERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
