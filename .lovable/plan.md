# Recurring tasks

## What you'll get
- In the edit task screen, a new **Repeat** option: Never, Daily, Weekly (pick a day, e.g. Monday), Monthly (pick a date, e.g. the 15th).
- Repeating tasks show a small repeat badge on the task row (e.g. "Every Mon", "Monthly on 15th") next to the reminder time.
- Ticking a repeating task done moves it to Completed and cancels its reminder for this time round.
- On the next repeat day (from midnight UK time) it reappears unticked in its section, and the normal reminder fires at the chosen time.
- If a repeating task isn't ticked, its reminder still fires once on the day; it then rolls on to the next date automatically, so it doesn't pile up.
- Monthly on 29th/30th/31st uses the last day in shorter months.
- Reminder time: uses the task's time if set, otherwise 9:00am (as now). Setting Repeat without a date starts from the next matching day.
- Setting Repeat back to Never keeps the task as a normal one-off.

## Technical details
- Migration on `tasks`: add `repeat` text (`none|daily|weekly|monthly`, default `none`, check constraint), `repeat_weekday` smallint (0-6), `repeat_day` smallint (1-31), `next_due_at` not needed — reuse `due_at` as the current occurrence.
- DB function `task_next_occurrence(due_at, repeat, weekday, day)` computing the next occurrence in Europe/London (keeps the same local time across GMT/BST).
- Extend `tasks_before_update` trigger: when a repeating task goes done=false → true, set `due_at` to the next occurrence (existing logic already resets `notified_at`).
- `send-push-notification` task-reminder job (already every minute):
  - Before sending, unmark done repeating tasks whose `due_at` falls on today (London) — `done=false`, `done_at=null`.
  - After notifying an unticked repeating task whose day has passed, roll `due_at` forward to the next occurrence.
- `task-notification-action` (tick from notification) goes through the same trigger, so it advances correctly with no change beyond verification.
- Frontend: `Task` type + `TaskDialog` Repeat select with weekday/date pickers; `TaskRow` repeat badge; helper in `src/lib/tasks/dateTime.ts` for first occurrence and labels; optimistic toggle refetches the task so the new date shows.
