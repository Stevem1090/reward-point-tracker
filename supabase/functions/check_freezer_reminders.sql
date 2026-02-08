-- Schedule the freezer reminder check alongside the existing reminders cron
-- This should be run once in the SQL editor to set up the cron job

SELECT cron.schedule(
  'check-freezer-reminders-every-minute',
  '* * * * *',
  'SELECT check_freezer_reminders();'
);
