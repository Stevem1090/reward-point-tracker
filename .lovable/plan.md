# Installable app, notifications and a new Tasks section

## 1. Install on your phone
- Add an app name, icon and theme colour so "Add to Home Screen" works on iPhone and Android and opens full screen like a normal app.
- Set a proper app title and description (replacing the "Lovable Generated Project" placeholder).
- No offline mode (not requested) - keeps updates instant.
- iPhone note: notifications only work once the app has been added to the Home Screen and opened from there (Apple rule).

## 2. Notifications (copied from Squirrel It / spot-stash-scan)
The old notification system here is replaced with the Firebase Cloud Messaging setup that works well in Squirrel It:
- Same "Notifications" settings card on the Profile page, including the "install the app first" prompt on iPhone, an enable switch and a "Send test notification" button.
- Each phone/browser you enable is remembered, so both your and your wife's devices get alerts; dead devices are cleaned up automatically.
- Tapping a notification opens the right page (e.g. the task).
- Existing weekly Reminders and freezer defrost alerts are switched over to the new system, and the old notification worker is retired safely.
- **You'll need a Firebase project for this app** (free). I'll show a connect card for Firebase Cloud Messaging - the same kind of setup you did for Squirrel It, with "Include web push" ticked. You could reuse the Squirrel It Firebase project, but a separate one keeps the apps apart.

## 3. New Tasks section (Google Keep style)
New "Tasks" page in the menu.
- **Sections**: starts with Today, Soon, Later. Add, rename and delete sections; drag a section by its handle to reorder.
- **Tasks**: quick-add line at the top of each section, tick box to mark done, done items drop into a collapsible "Completed" list (untick to restore), tap a task to edit, menu to delete.
- **Drag and drop**: press-and-hold (phone) or grab the handle to drag a task up/down within a section or into another section (e.g. Soon to Today). Order is saved for everyone.
- **Shared vs private**: tasks are shared with the household by default; a "Only me" toggle hides a task from everyone else. Private tasks show a small lock icon.
- **Dates**: optional due date and time. Overdue tasks are highlighted; dated tasks show the date on the row.
- **Reminders**: a task with a date/time sends a notification at that time - to everyone for shared tasks, only to the owner for private ones. Each task notifies once (not repeated after being ticked off).
- The existing weekly-repeating Reminders page stays as it is.

## Questions resolved by default (tell me to change)
- Time without a date isn't allowed; date without a time notifies at 9:00am UK time.
- Shared = everyone with an account in the app (matches how rewards/bills work today).

## Technical details
- `public/manifest.webmanifest`, generated 192/512 + maskable + apple-touch icons, head tags in `index.html`. No vite-plugin-pwa.
- Port from spot-stash-scan: `public/firebase-messaging-sw.js` (click handler registered before messaging init), push client lib, `NotificationsSection`/install card, `send-push` edge function using the Firebase connector gateway.
- New `push_tokens` table (user_id, token, platform, last_seen). Replace `public/sw.js` with the kill-switch worker for one release; remove old VAPID subscribe code.
- Point `check_and_send_reminders` / `check_freezer_reminders` at `send-push`.
- New tables with GRANTs + RLS:
  - `task_sections` (name, sort_order, created_by) - readable/editable by authenticated users.
  - `tasks` (section_id, title, notes, done, done_at, due_at, is_private, owner_id, sort_order, notified_at, timestamps). RLS: select/update/delete where `is_private = false OR owner_id = auth.uid()`; insert with `owner_id = auth.uid()`.
  - Seed Today / Soon / Later.
- Edge function `send-task-reminders`: finds `done = false AND due_at <= now() AND notified_at IS NULL`, calls `send-push` (FCM), deletes UNREGISTERED tokens, sets `notified_at`. pg_cron every minute. Editing `due_at` resets `notified_at`.
- Drag and drop with existing dnd-kit (touch sensor with press delay, multi-container sortable); optimistic reorder then batch-update `sort_order`/`section_id`.
- New `src/pages/TasksPage.tsx`, `src/hooks/useTasks.ts`, `useTaskSections.ts`, components under `src/components/tasks/`, route `/tasks` + nav entry.
