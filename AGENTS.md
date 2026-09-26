- Push notifications use Firebase Cloud Messaging via the connector gateway: `send-push-notification` edge function + `push_tokens` table + `public/firebase-messaging-sw.js` (scope /firebase-cloud-messaging-push-scope). Why: old VAPID/sw.js system was unreliable on installed phone apps.
- PWA is manifest-only (no app-shell service worker); `public/sw.js` is a kill-switch for the retired worker. Why: avoid stale cached app versions.
- Background task completion from push notifications uses short-lived, task-specific HMAC tokens handled by `task-notification-action`. Why: complete only the notified task without exposing a reusable user session.
- Task reminder input and display use `Europe/London` explicitly. Why: keep selected times stable across device timezone differences and GMT/BST changes.

- Multi-family: shared tables carry `family_id` (default `current_family_id()`) with RLS "same family"; membership in `family_members`, invites via RPCs + `send-family-invite`; `FamilyGate` runs `ensure_family` on load. Why: separate households in one app, master controls members.
- App sections are defined once in `src/config/appSections.ts` and reused by the dashboard and navigation. Why: labels, paths, and icons stay synchronized.
- In-app feedback uses the Radix toast system through `use-toast`/`lib/toast`; Sonner is not mounted. Why: match the single bottom-centre Squirrel It snackbar experience.
