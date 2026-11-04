# Roadmap

- [x] Add a dedicated phone notification icon.
- [x] Add supported notification actions, including background task completion.
- [x] Remove the unnecessary task reminder subtitle.
- [x] Correct task reminder display and editing to Europe/London time.
- [x] Deploy and verify the notification functions and mobile task flow.
## Android app (private, Steve & Tasha)
- [x] App shell (Capacitor, loads published site, back button, exports via share sheet)
- [x] Native notifications (own Android service, channels, Mark done / View)
- [x] Server sends Android-specific high-priority messages + task sync/cancel messages
- [x] Backup reminders stored on the phone (no duplicates, cancelled when done elsewhere)
- [x] Setup/health card (permission, battery unrestricted, test)
- [ ] GitHub build workflow producing signed APK (setup-android step removed after it failed; needs a clean run)
- [ ] User: Firebase Android app + google-services.json, GitHub secrets, install APK
## Committed Spending
- [x] Column labels in every card, Done cards at bottom, topline budget with sub-line actuals
- [x] Account pills only for accounts used this month + "Select account" dropdown

## Vinted drafts
- [x] Phase 0: Diagnostics screen (in-app browser, login, dry-run test, payload measurement)
- [x] Phase 0 phone test (dry run passed)
- [ ] Live test on phone: waiting on Steve to confirm ok: true + draftId
- [x] Phase 1: AI photo analysis + hard validation (analysis test on Diagnostics)
- [ ] Phase 2 (blocked until live test confirmed): review UI, queue, README (after Phase 1)
