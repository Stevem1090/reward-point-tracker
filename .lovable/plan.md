# Installable app, notifications and a new Tasks section

## 1. Install on your phone
- Add an app name, icon and theme colour so "Add to Home Screen" works on iPhone and Android and opens full screen like a normal app.
- Set a proper app title and description (replacing the "Lovable Generated Project" placeholder).
- No offline mode (not requested) - keeps updates instant.
- iPhone note: notifications only work once the app has been added to the Home Screen and opened from there (Apple rule).

## 2. Notifications
The app already has a notification system (used by Reminders). It will be tidied and reused:
- One clear "Enable notifications" switch on the Profile page, with a "Send test notification" button.
- Friendly messages when it can't work (e.g. inside the editor preview - open the installed/published app instead; permission blocked - how to re-allow in settings).
- Tapping a notification opens the relevant page in the app (e.g. the task).
- The existing background worker keeps handling notifications, but its old page-caching is removed so it can never show a stale version of the app.

## 3. New Tasks section (Google Keep style)
New "Tasks" page in the menu.
- **Sections**: starts with Today, Soon, Later. Add, rename, reorder and delete sections.
- **Tasks**: quick-add line at the top of each section, tick box to mark done, done items drop into a collapsible "Completed" list (untick to restore), tap a task to edit, swipe/menu to delete or move to another section.
- **Shared vs private**: tasks are shared with the household by default; a "Only me" toggle hides a task from everyone else. Private tasks show a small lock icon.
- **Dates**: optional due date and time. Overdue tasks are highlighted; dated tasks show the date on the row.
- **Reminders**: a task with a date/time sends a notification at that time - to everyone for shared tasks, only to the owner for private ones. Each task notifies once (not repeated after being ticked off).
- The existing weekly-repeating Reminders page stays as it is.

## Questions resolved by default (tell me to change)
- Time without a date isn't allowed; date without a time notifies at 9:00am UK time.
- Shared = everyone with an account in the app (matches how rewards/bills work today).

## Technical details
- `public/manifest.webmanifest`, generated 192/512 + maskable + apple-touch icons, head tags in `index.html`. No vite-plugin-pwa.
- `public/sw.js`: strip install/fetch caching, keep `push` + `notificationclick` (open `data.url`).
- New tables with GRANTs + RLS:
  - `task_sections` (name, sort_order, created_by) - readable/editable by authenticated users.
  - `tasks` (section_id, title, notes, done, done_at, due_at, is_private, owner_id, sort_order, notified_at, timestamps). RLS: select/update/delete where `is_private = false OR owner_id = auth.uid()`; insert with `owner_id = auth.uid()`.
  - Seed Today / Soon / Later.
- Edge function `send-task-reminders` (service role): finds `done = false AND due_at <= now() AND notified_at IS NULL`, sends web push via existing VAPID/`user_push_subscriptions`, removes stale subscriptions (404/410), sets `notified_at`. Run every minute by pg_cron + pg_net. Editing `due_at` resets `notified_at`.
- New `src/pages/TasksPage.tsx`, `src/hooks/useTasks.ts`, `useTaskSections.ts`, components under `src/components/tasks/`, route `/tasks` + nav entry.
- Notification toggle consolidated into existing `useUserNotifications` with iframe/unsupported/denied states.
