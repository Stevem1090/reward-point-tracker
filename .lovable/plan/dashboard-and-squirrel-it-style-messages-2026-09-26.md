# Dashboard and Squirrel It-style messages

## Dashboard
- Add a new signed-in dashboard at `/` and make it the default screen after login or opening the app.
- Show seven clear, tappable tiles for **Tasks, Rewards, Bills, Meals, Chores, Slimming World, and Profile & notifications**.
- Give every tile its existing section icon, a short useful label, and a distinct accent while keeping the current Family Hub visual style.
- Make the tile grid comfortable on the current mobile view and scale cleanly to tablet and desktop.
- Add **Dashboard** as the first item in both the mobile menu and desktop sidebar so users can return to it from any section.

## In-app messages
- Replace the current mixed toast setup with the exact Squirrel It-style Radix snackbar system already used in the reference project.
- Display messages bottom-centre above the phone safe area, with compact rounded styling, downward swipe dismissal, and no close button.
- Use short automatic durations: about 1.8 seconds for normal/success messages and 4 seconds for errors.
- Preserve every existing message and action while migrating the few Sonner-only calls to the unified toast system.
- Remove the second Sonner toaster so messages cannot duplicate or use inconsistent styling.

## Technical details
- Add a focused `DashboardPage` and route it at `/`, replacing the current redirect to Rewards.
- Reuse a single shared section definition for dashboard tiles and navigation where practical, preventing labels, paths, and icons from drifting apart.
- Port the reference toast primitives, viewport positioning, variants, and timing into the existing toast files; no database or family-sharing changes.
- Update the app metadata to describe Family Hub rather than retaining any template defaults, if needed.
- Verify the dashboard and navigation at mobile and desktop sizes, then trigger both normal and error messages to confirm placement, timing, and styling.
