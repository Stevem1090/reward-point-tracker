# Reliable push notifications — Part 1: high-urgency delivery, de-duplication, logging

## Goal
Stop reminders being silently dropped when a phone is asleep (Doze mode), and make every send observable. Part 2 (display receipts and automatic retries) is deliberately out of scope for now — we revisit it once we've seen whether Part 1 fixes the problem.

## Changes to `send-push-notification`

### 1. Urgency
- Set `Urgency: high` in `webpush.headers` on every message.
- Do not use `android.priority` — it only applies to native Android apps, not our PWA.

### 2. TTL per notification type (in `webpush.headers`)
Single config object at the top of the function so values are easy to change:

```text
TTL_SECONDS = {
  taskReminder: 14400,   // 4 hours
  assignment:   86400,   // 24 hours
  freezer:      86400,   // 24 hours
  test:           300,   // 5 minutes
}
```

Each send path picks its TTL from this object.

### 3. De-duplication (two separate mechanisms)
- **Topic header:** set `webpush.headers.Topic` to a stable per-task value so Google replaces any undelivered queued message for the same task instead of delivering several when the phone reconnects. Topic must be ≤32 chars, URL-safe base64 (A–Z, a–z, 0–9, `-`, `_`) — derive it from the task ID (e.g. `task-` + task UUID with dashes stripped, truncated to 32 chars).
- **Tag:** set a stable per-task `tag` as a notification option (in `showNotification` in `public/firebase-messaging-sw.js`, or `webpush.notification.tag`) — not as a header.
- Set `renotify: true` so a replacement notification still sounds and vibrates rather than appearing silently.

### 4. Confirm how notifications are displayed (before changing anything)
- Determine whether the Firebase SDK is auto-displaying notifications (because the payload includes a `notification` block) or whether our service worker calls `showNotification` itself. Report which it is before editing — it decides where `tag` and `renotify` must live and avoids duplicate banners.
- Whatever displays the notification in the service worker must be inside `event.waitUntil`.

### 5. Log FCM responses and clean up dead subscriptions
- Log the outcome of every FCM send (success, or error code and message) with the task ID and subscription ID. Never log tokens.
- If FCM returns UNREGISTERED / 404 / 410, delete that push subscription so we stop sending to it. (The existing stale-token pruning covers 404/UNREGISTERED; extend it to 410 and add the structured logging.)

## Unchanged
Recipients, icons, Mark done / View task actions and their existing HMAC tokens, cron schedule, and all other app behaviour.

## Verification
- Test push arrives with the new headers; show the final FCM payload for each notification type (task reminder, assignment, freezer, test).
- Put the test phone into Doze (`adb shell dumpsys deviceidle force-idle`), send a test reminder, confirm it displays promptly. *(Requires your phone connected via adb — I'll prepare everything and give you the exact steps.)*
- Send the same task reminder twice in quick succession: only one notification shows, and the second still makes a sound.
- Confirm Mark done / View task still work.
- Confirm a deliberately invalid subscription is logged and removed.
- Typecheck and build clean, then deploy the updated function.
