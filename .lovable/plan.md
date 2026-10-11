# Family Hub as a private Android app

Goal: an installable Android app for Steve and Tasha only (no iOS, no Play Store). Every feature works exactly as on the web, and notifications are delivered by Android itself rather than the browser, so they arrive on time, survive cache clearing, and keep the Mark done / View actions. The website and PWA stay live alongside it.

## How it will work

```text
            Supabase (unchanged data, cron, edge functions)
                           |
          send-push-notification picks channel per device
              /                                   \
   web token -> Web Push (as today)     android token -> native FCM (high priority, data message)
                                                     |
                                    App's own notification service builds the alert
                                    (channel, sound, Mark done / View buttons)
```

The app is a Capacitor shell that loads the published Family Hub site, so every change made here appears in the app immediately with no reinstall. Only native changes (notification code, icon, permissions) need a new APK.

## Phase 1 – App shell

- Add Capacitor (Android only), app ID `app.lovable.p6d6906c6162c45aeb91047ebf987bb28`, name "Family Hub", using the existing icon and theme colours.
- Load the published URL; keep login, links, and Supabase sessions inside the app (no jumps to Chrome). Android back button navigates back, then exits from the dashboard.
- Status bar / safe-area colours matched to the app theme; splash screen.
- Detect "running in the app" in code so the web-only bits (install banner, service worker registration, "open in new tab" notices) are skipped there.
- File features adjusted for Android: PDF/spreadsheet exports in Bills save and open via the share sheet; recipe photo upload offers camera or gallery. Everything else needs no change.

## Phase 2 – Native notifications (the priority)

Device registration
- Use the native Firebase Messaging plugin to request Android 13+ notification permission and get a native FCM token; save it to `push_tokens` with `platform = 'android'`.
- Re-save the token on every app start, on resume, and whenever Firebase rotates it (native token-refresh event fires even when the app is closed). Unlike the browser, clearing Chrome data cannot remove it.
- Disabling notifications in Profile deletes only that device's token, as today.

Sending (edge function)
- `send-push-notification` checks each token's platform. Web tokens get exactly today's payload. Android tokens get a data-only message with `android.priority: HIGH`, the same per-type TTL, and a `collapse_key` equal to the existing stable Topic value so repeats replace rather than stack.
- Same recipients, logging, and pruning of UNREGISTERED/404 tokens.

Displaying (native code in the APK)
- A small custom Android notification service receives every message, even when the app is killed or the phone is dozing (high-priority data messages are allowed to wake it).
- Notification channels: "Task reminders" and "Assigned tasks" (high importance, heads-up, sound, vibration), "Freezer alerts", "Test". Users can tune each in Android settings.
- Same tag per item so a resent reminder replaces the old one and still sounds.
- Buttons: "Mark done" posts the existing short-lived task token to `task-notification-action` in the background (no app opening), then clears the notification and shows a brief "Done" confirmation; on failure it keeps the notification and shows "Couldn't mark done – tap to open". "View" / tapping opens the app straight to the task.

Reliability extras
- First-run setup screen in the app checks and guides through: notification permission, "Unrestricted" battery usage (opens the exact settings page), and on Samsung-type phones the "never sleeping apps" list. A health card in Profile shows green/red for each, plus "Send test".
- Local backup alarms: when the app syncs, it schedules exact Android alarms for the person's upcoming due reminders (next 7 days). If the server push already arrived, the alarm is silently skipped (shared tag/ID); if the push was lost, the alarm fires on time anyway. Alarms are rescheduled after phone restart and whenever tasks change, and cancelled when a task is ticked or deleted.
- Delivery logging continues server-side so we can check any missed notification as before.

## Phase 3 – Building and installing

- GitHub Actions workflow builds a signed release APK on every push to the repo and attaches it to a GitHub Release (no Android Studio needed).
- One-time: create a signing key (stored as GitHub secrets), add the Android app to the Firebase project and store its `google-services.json` as a secret.
- Install: download the APK on each phone, allow "install unknown apps" once. Updates install over the top, keeping login and settings.
- Optional: in-app banner when a newer APK release exists.

## Phase 4 – Verification

- Each notification type received with app open, backgrounded, swiped away, and after a reboot.
- Doze test (screen off 1h+, `adb` forced idle) – reminder arrives on time.
- Same reminder sent twice: one notification, second still sounds.
- Mark done from the lock screen ticks the task for everyone; View opens the right task.
- Turn off mobile data at reminder time: local alarm fires.
- Invalid token logged and removed. Web/PWA notifications still work unchanged.
- Full feature walk-through in the app: login, dashboard, tasks (list/board, filters, recurring), bills + exports, meal planner, recipe photos, rewards, calendar, family invites.

## What you'll need to do

1. Connect the project to GitHub (Export to GitHub).
2. In Firebase console, add an Android app with the package name above and download `google-services.json` (I'll give step-by-step guidance).
3. Add three GitHub secrets I'll name for you.
4. Install the APK on both phones and complete the setup screen.

## Technical details

- Packages: `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` (dev), `@capacitor-firebase/messaging`, `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/local-notifications` (backup alarms, `allowWhileIdle`, `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM`), `@capacitor/camera`.
- `capacitor.config.ts`: `server.url` = published URL, `allowNavigation` for Supabase domains; `webDir: dist` fallback.
- The `android/` folder is generated in CI (`npx cap add android`) and then patched by a script that adds: custom `FirebaseMessagingService` subclass (builds notifications with actions), `BroadcastReceiver` for Mark done (uses `goAsync` + HTTP POST), boot receiver, channels, permissions (`POST_NOTIFICATIONS`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `RECEIVE_BOOT_COMPLETED`). Native sources live in `native/android/` in the repo so they're versioned.
- `src/lib/push/` gets a platform switch: `registerPush.ts` (web, unchanged) and `registerNativePush.ts` (Capacitor), behind one interface used by Profile and `App.tsx`. Service-worker code paths are skipped when `Capacitor.isNativePlatform()`.
- Edge function: per-token branch on `platform`; Android payload `{ token, data: {type,title,body,url,taskId,actionToken,actionUrl,tag}, android: { priority: "HIGH", ttl: "<n>s", collapse_key: topic } }`. No `notification` block, so the app always controls display and actions.
- Local backup alarm IDs derived from task ID + due time; native service cancels the matching scheduled alarm when the push arrives.
- AGENTS.md updated with the native/web push split rule.
