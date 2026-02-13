

# Fix Notification Delivery and Build Errors

## Summary of Issues Found

### 1. Regular reminders use a placeholder auth token (critical)
The `check_and_send_reminders()` database function calls the edge function with `'Authorization', 'Bearer your_token_here'` instead of the real anon key. This means your "Hello Steve" Saturday reminder (and any future reminders) silently fail every time. The freezer reminder function has the correct key -- this one was just never updated.

### 2. Freezer reminders were sent before you had a subscription
All defrost reminders fired correctly at 6:00 PM each evening, but your push subscription was only created at 10:03 PM tonight. So the edge function responded "No subscriptions found" each time. Now that your subscription exists, future freezer reminders should work.

### 3. TypeScript build errors on `pushManager`
The `pushManager` property isn't in the default TypeScript type for `ServiceWorkerRegistration`. This needs a type declaration fix.

## Plan

### Step 1: Fix the auth token in `check_and_send_reminders()`
Run a SQL statement (via the SQL editor, not a migration) to replace the placeholder `'Bearer your_token_here'` with the real anon key in the `check_and_send_reminders()` function. This is the same key already used in `check_freezer_reminders()`.

### Step 2: Fix TypeScript build errors
Add a type declaration file `src/types/service-worker.d.ts` that extends `ServiceWorkerRegistration` to include the `pushManager` property. This resolves all 6 build errors across `useSubscriptionManager.ts` and `usePushNotifications.ts`.

### Step 3: Reset freezer reminder flags for testing
Reset `reminder_sent = false` on your current freezer flags so the cron job will re-attempt delivery now that your subscription is active. This lets us verify the full flow works end-to-end.

