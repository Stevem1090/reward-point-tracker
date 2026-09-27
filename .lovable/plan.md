# Reliable push notifications: high-urgency delivery + display receipts with retry

## Goal
Stop reminders being silently dropped when a phone is asleep (Doze mode). Two layers:
1. Tell Google/Android the message is time-sensitive so it wakes the device immediately.
2. Know when a notification actually displayed on the phone, and automatically re-send it if it didn't.

## Part 1 — High-urgency delivery headers

In `send-push-notification`, add to every FCM web push message:
- `Urgency: high` — tells Android to wake the device and display immediately, even in Doze.
- `TTL: 86400` — if the phone is offline, Google holds the message for up to 24 hours instead of discarding it quickly.
- A stable `Tag` per task — if a reminder is re-sent before the first displays, the phone replaces the old one rather than stacking duplicates.

Applies to task reminders, assignment notices, freezer alerts, and test pushes.

## Part 2 — Display receipt (ACK) and automatic retry

### How it works
```text
Cron (every minute)
  → send-push-notification finds due task
  → sends FCM push with Urgency: high + tag
  → phone receives it, service worker wakes
  → worker shows the banner AND posts an "I displayed it" receipt
  → server records displayed_at on the task

10 minutes later, cron checks again:
  → task still has no displayed_at? → re-send (max 2 retries)
  → displayed? → nothing more to do
```

### Changes

**Database (one migration):**
- Add `displayed_at timestamptz` and `notify_attempts int default 0` to `tasks`.
- Update the reminder SQL (`check_and_send_reminders`) so the cron also picks up tasks that were notified 10+ minutes ago, have no `displayed_at`, and have fewer than 3 attempts — these get re-sent.

**Notification worker (`public/firebase-messaging-sw.js`):**
- After showing a notification, POST a receipt to `task-notification-action` with the task ID and the same short-lived, task-specific token already used for "Mark done" (action: `ack`). No login needed, no reusable credential.
- If the phone is offline when the push arrives, the receipt simply never sends — which is exactly what triggers the retry.

**`task-notification-action` edge function:**
- Accept a new `ack` action alongside the existing mark-done action: validate the token, set `displayed_at` on that one task only.

**`send-push-notification` edge function:**
- When re-sending, increment `notify_attempts` and issue a fresh action token.
- Keep the existing behaviour unchanged otherwise (recipients, icons, Mark done / View task actions).

**App behaviour:**
- When a task is opened/completed in the app, treat that as seen too (set `displayed_at`) so no pointless retry fires.
- No visible UI changes — this is all behind the scenes.

## Limits to be aware of
- If the phone is fully off or has no signal for hours, the TTL holds the message but nothing can force it through until the phone reconnects.
- Android battery settings ("Restricted" for Chrome/Family Hub) can still delay things; "Unrestricted" on Tasha's phone remains the best device-side complement.

## Verification
- Create a test task due immediately, confirm the push sends and `displayed_at` gets recorded when the banner shows.
- Simulate a dropped notification (no receipt) and confirm the cron re-sends it after ~10 minutes, and stops after the retry cap.
- Confirm Mark done / View task actions still work.
- Typecheck and build clean; deploy both updated edge functions.
