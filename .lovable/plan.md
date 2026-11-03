# Vinted drafts — Phase 0 only: Browser spike (Diagnostics screen)

Build Phase 0, then stop so you can test on the phone. Phases 1–2 (AI analysis, validation, review UI, queue, README) wait for your go-ahead.

## Script check (new upload)
The new `vinted-create-draft.js` replaces the old copy. It has 444 lines and defines `notifyHost` at line 35. It sends all four events through `window.mobileApp.postMessage({ detail })`, with the AndroidBridge and window-event fallbacks:
- `vinted:started`
- `vinted:report`
- `vinted:saveResult`
- `vinted:fatal`

There is no stopgap bridge. The app listens only through `messageFromWebview`. Every run injects the item (with `itemId`) first, then the script, which runs on its own.
- `itemId` comes back as text, so the app compares it as text.
- A `fatal` event with no `itemId` counts as part of the run in progress, because only one run happens at a time.

## Plugin findings
- Package: `@capgo/inappbrowser`, used through `openWebView()`. I'll pin a version that has `customUserAgent`, which was added in 8.13.0. The npm "latest" tag currently shows 8.6.14, so I'll check this at install time.
- These options cover most of what we need:
  - `customUserAgent`: a desktop Chrome user agent string
  - `persistWebViewData: true` (the default): Android keeps cookies in the shared WebView cookie store
  - `preventDeeplink: true`: stops the jump to the "open in the Vinted app" link
  - `captureConsoleLogs`
  - `executeScript`
  - the `messageFromWebview` event
- There is no wide-viewport or desktop-mode option. A desktop user agent may be enough to make Vinted serve its desktop page. If the page still lays out at phone width, we add a small native plugin (Java, matching the existing `native/android` code). It turns on `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` for the plugin's WebView. It lives in `native/android/` and the build script copies it in, like the existing notification code. Diagnostics shows the page width so we can tell whether this is needed.

## Diagnostics screen (Profile → Diagnostics → Vinted browser)
- **Open Vinted**: opens `https://www.vinted.co.uk/items/new` in the managed WebView. You log in there yourself. The app never reads, stores or logs credentials or cookies.
- **Status panel:**
  - current URL, live from the plugin's URL-change events
  - logged in yes/no: whether `#title` exists on `/items/new`
  - plugin version
  - user agent actually in use (`navigator.userAgent` read back from the page)
  - page width (`window.innerWidth`)
- **Blocker detection** after each page load. A small read-only probe reports any of these:
  - bot check or captcha (DataDome or captcha frames)
  - login wall (redirected to the sign-in page)
  - an "open in the app" interstitial
  - mobile layout served
- **Run test (dry run)**:
  1. Builds a built-in test item. IDs are read only from the reference JSON, and images are made from 5 photos you pick.
  2. Resizes each photo to about 1000px on the longest edge, JPEG quality 0.8.
  3. Sets the item: either in one `executeScript` call, or in chunks into `window.__VINTED_IMG_CHUNKS__` if a single call is too large.
  4. Injects the script text with `saveDraft: false`.
- **Payload measurement**: records the payload size, how long each call took, and whether a single call failed. Then it falls back to chunks automatically and reports the limit it hit.
- **Live log**: every event and console line, with timestamps, plus the final report. There's a Copy button so you can paste it back to me.
- The 120-second timeout, live mode and the queue are not part of Phase 0.
- On the website (not the Android app), the screen just says "Android app only".

## Assets
- `src/vinted/vinted-create-draft.js`: copied byte-for-byte and imported with `?raw`.
- `src/vinted/vinted-reference-kids.json` and `src/vinted/vinted-reference-kids-for-ai.txt`: stored as given. The capture date (3 Nov 2026) is shown on the screen.

## Technical details
- New files:
  - `src/vinted/browser.ts`: plugin wrapper (open, inject, listeners)
  - `src/vinted/imageResize.ts`
  - `src/vinted/testItem.ts`
  - `src/vinted/bridge.ts`: stopgap B
  - `src/pages/VintedDiagnostics.tsx` and its route
- The Android app needs a reinstall, because this adds a new native plugin. The GitHub workflow already runs `cap sync`, so it picks the plugin up.
- I'll record the "in-app browser plugin + script as a raw asset" decision in AGENTS.md.

## What you'll test on the phone after Phase 0
1. Install the new build. Open Diagnostics, then Open Vinted, then log in.
2. Close the app and reopen it. You should still be logged in.
3. Check: is it the desktop layout (page width), what does the status panel show, and are any blockers reported?
4. Pick 5 real photos and run the dry run. Copy the log and send it to me.
