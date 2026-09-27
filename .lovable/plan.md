# Remove the large notification icon

## What will change
- Stop sending the large `icon` image in Firebase web notifications.
- Keep the small monochrome `badge` icon used in the notification header and status bar.
- Leave notification titles, notes, links, and task actions unchanged.

## Verification
- Confirm the app still builds successfully.
- Deploy the updated push notification function so new alerts use the cleaner layout.
