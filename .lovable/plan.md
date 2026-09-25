# Stop Android flagging reminders as possible spam

## Why it happens
Chrome on Android checks every web notification on the phone itself. If one looks unusual, it adds a "possible spam" warning. The checks look at things like very short or empty text, emoji-led titles, and sites the phone doesn't treat as a trusted app. Our task alerts currently have a title that starts with an emoji ("⏰ Task") and often no body text, and alerts from a Chrome tab get stricter checks than alerts from an installed app. Google doesn't publish the exact rules, so we can't be certain which of these causes the warning. The changes below cover the likely causes.

## What will change
- **Clearer alert text**: the title will be "Task reminder: <task name>" with no emoji. The second line will always show useful text, like "Due today at 20:30", plus the notes if there are any. (This brings back a short second line, but it now shows the due time, not the old generic "Task reminder" text.)
- **Consistent sender details**: every alert will carry the Family Hub name, app icon and small status-bar icon. Each task will have its own tag, so a repeat replaces the old alert instead of stacking up.
- **Test notification** will use the same format, so you can check it straight away.
- **Settings tip**: the Notifications card will explain that alerts are most reliable when Family Hub is installed to the home screen. If Android shows the warning, tap it and choose "Allow" or "Don't flag" so it stops warning for Family Hub.

## What you'll need to do
- Make sure Family Hub is installed from Chrome ("Install app"), not just open in a browser tab, and turn notifications on from the installed app.
- If a warning appears, tap "Always allow" on it once.

## Technical details
- `send-push-notification`: add a title prefix, build the body from `formatTaskDue`-style Europe/London text (+ notes), set `webpush.notification.tag = task-<id>`, `renotify: false`, and keep icon/badge. Redeploy.
- `sendTestPush` path uses the same builder.
- Small copy addition in `NotificationSettings.tsx`.
