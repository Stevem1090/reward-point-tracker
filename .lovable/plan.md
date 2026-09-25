# Task notification and reminder improvements

## What will change

### Header notification button
- Add a small bell button to the Family Hub header on phone and desktop.
- Show a subtle count badge when unfinished reminders are due.
- Open a compact notification panel listing due and overdue tasks, with the task name and correctly formatted date/time.
- Give every item a checkbox so it can be marked complete directly from the panel; completing it updates the Tasks page immediately.
- Selecting the reminder text opens the task for editing, while the checkbox remains a separate action.
- Include clear empty, loading, and error states without adding another full page.

### Phone notification presentation
- Use the existing Family Hub icon and badge consistently, with the task name as the main notification title.
- Remove the fallback “Task reminder” subheading. Notes will appear only when the task actually has notes; otherwise the alert will have no unnecessary secondary text.
- Tapping a phone notification opens the Tasks area, where the same reminder can be checked off.
- Keep styling within what iPhone and Android notifications permit; the phone controls the outer notification appearance.

### Reminder time correction
- Treat dates and times selected in the task editor as Europe/London local time, including automatic GMT/BST changes.
- Convert that local selection to UTC only when saving, then format it back to Europe/London everywhere it is displayed.
- Apply the same conversion when reopening a task so the selected time does not shift.
- Verify the exact reported case and test dates on both sides of the daylight-saving transition.

## Technical details
- Add shared task date helpers using `date-fns-tz` so task editing, task rows, and the header panel use one conversion rule.
- Add a focused header notification panel component backed by the existing tasks table and update flow; no new notification database is required.
- Adjust the Firebase send function so notification body text is optional and deploy the updated function.
- Keep the existing authenticated access rules: users see shared tasks and their own private tasks, and task completion uses the current task permissions.
- Validate on the mobile-sized preview and desktop, then verify the project compiles and the deployed notification function accepts the updated payload.
