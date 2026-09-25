# Task notification and reminder improvements

## What will change

### Phone notification presentation
- Create a dedicated, simple notification icon for the small status-bar/header symbol and notification list, rather than using the full-colour app icon.
- Supply the transparent monochrome icon in the Firebase notification payload so Android can render it clearly at small sizes; retain the Family Hub app icon where the device supports a larger notification image.
- Remove the fallback “Task reminder” subheading. Notes will appear only when the task actually has notes; otherwise the alert will have no unnecessary secondary text.
- Add notification actions for “Mark done” and “View task” where the phone/browser supports them.
- On supported Android browsers, “Mark done” completes the task in the background without opening Family Hub. “View task” opens the relevant task.
- On iPhone, where installed web-app notifications do not reliably expose custom action buttons, tapping the alert opens the task so it can be ticked there.
- Keep styling within what iPhone and Android notifications permit; the phone controls the outer notification appearance.

### Reminder time correction
- Treat dates and times selected in the task editor as Europe/London local time, including automatic GMT/BST changes.
- Convert that local selection to UTC only when saving, then format it back to Europe/London everywhere it is displayed.
- Apply the same conversion when reopening a task so the selected time does not shift.
- Verify the exact reported case and test dates on both sides of the daylight-saving transition.

## Technical details
- Add shared task date helpers using `date-fns-tz` so task editing, task rows, and the header panel use one conversion rule.
- Pass the task ID and supported action details through Firebase, and handle notification action clicks in the existing notification worker.
- Issue a short-lived, task-specific signed action token with each reminder, allowing the background worker to complete only that task without exposing a reusable login credential. Add a narrowly scoped server action that validates this token before marking the task done.
- Adjust the Firebase send function so notification body text is optional, uses the dedicated small icon, and deploy the updated function.
- Keep the existing authenticated access rules: users see shared tasks and their own private tasks, and task completion uses the current task permissions.
- Validate on the mobile-sized preview and desktop, then verify the project compiles and the deployed notification function accepts the updated payload.
