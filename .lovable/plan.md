# Reliable push notifications — Part 1: high-urgency delivery, de-duplication, logging

## Goal
Stop reminders being silently dropped when a phone is asleep (Doze mode), and make every send observable. Part 2 (display receipts and automatic retries) is deliberately out of scope for now — we revisit it once we've seen whether Part 1 fixes the problem.

## Step 4 finding (checked first, before edits)
The Firebase SDK auto-displays notifications: the FCM payload includes a `notification` block, and `public/firebase-messaging-sw.js` only registers a `notificationclick` handler — it never calls `showNotification`. Consequences:
- `tag` and `renotify` must be set in `webpush.notification` in the FCM payload (FCM maps these to the displayed notification), not in the service worker.
- No duplicate-banner risk from the worker; no `event.waitUntil` change needed for display (the existing click handler already uses `event.waitUntil`).

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

### 3. De-duplication (Topic header + notification tag)
- **Unique per notification type AND per item**, so a reminder and an assignment notice for the same task never replace each other. Use a short type prefix plus the item ID:
  - `rem_` + task ID (task reminders)
  - `asg_` + task ID (assignment notices)
  - `frz_` + freezer item ID (freezer alerts)
  - Test pushes: unique value each time (or no topic/tag).
- **Encoding (no truncation):** base64url-encode the UUID's 16 raw bytes (22 characters, no padding), add the 4-char type prefix → 26 characters, within the 32-char limit, using only URL-safe characters (A–Z, a–z, 0–9, `-`, `_`).
- **Topic:** set `webpush.headers.Topic` to this value so Google replaces any undelivered queued message for the same item+type instead of delivering several when the phone reconnects.
- **Tag:** set the same value in `webpush.notification.tag` (a notification option, not a header).
- Set `renotify: true` in `webpush.notification` so a replacement notification still sounds and vibrates.

### 4. Log FCM responses and clean up dead subscriptions
- Log the outcome of every FCM send (success, or error code and message) with the item ID and subscription ID. Never log tokens.
- Delete the push subscription only on **404, 410, or UNREGISTERED**.
- Do **not** delete on 400 / INVALID_ARGUMENT — that can be caused by a malformed payload and would wipe valid subscriptions. Log 400s with the full error body so we can see them.

## Unchanged
Recipients, icons, Mark done / View task actions and their existing HMAC tokens, cron schedule, and all other app behaviour.

## Verification
- Test push arrives with the new headers; show the final FCM payload for each notification type (task reminder, assignment, freezer, test).
- Doze test on the test phone, full sequence:
  ```text
  adb shell dumpsys battery unplug
  adb shell dumpsys deviceidle force-idle
  (send test reminder)
  adb shell dumpsys deviceidle unforce
  adb shell dumpsys battery reset
  ```
  Confirm the reminder displays promptly while forced idle. *(Requires your phone connected via adb — I'll prepare everything and give you the exact steps.)*
- Send the same task reminder twice in quick succession: only one notification shows, and the second still makes a sound.
- Confirm Mark done / View task still work.
- Confirm a deliberately invalid subscription is logged and removed.
- Typecheck and build clean, then deploy the updated function.
