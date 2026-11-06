/**
 * Vinted page probe. Tiny, standalone, safe to inject on ANY vinted.co.uk page, before the main script.
 *
 * Why it exists: when Vinted shows a "Server error" page instead of the listing form, the main script is not
 * running (or is about to time out), and reloading the page wipes any injected script. So recovery has to be driven
 * by the host app: after every navigation to /items/new, inject this probe, call vintedCheckPage(), and decide
 * from the event it sends back whether to carry on, reload, wait, or stop.
 *
 *   window.vintedCheckPage({ timeoutMs: 15000 })
 *       Polls the page and sends ONE final event, then stops. Event (via window.mobileApp.postMessage({ detail }),
 *       window.AndroidBridge.postMessage(json), and a window event 'vinted-draft-event'):
 *         { type: 'vinted:pageStatus', final: true, state, reason, path, title, headline, hasReloadButton, waitedMs }
 *       state is one of:
 *         ready       the listing form is there (#title and the photo input). Safe to inject the main script.
 *         error_page  Vinted is showing an error page (for example "Server error" or "Sorry, something went wrong").
 *                     Nothing has been saved. Reload and retry.
 *         login_wall  a login or sign-up page. Do NOT retry; ask the user to log in.
 *         timeout     nothing recognisable appeared within timeoutMs. Treat like error_page (reload and retry).
 *
 *   window.vintedPageStatus()
 *       Instant, synchronous version of the same classification. Returns the object and does not send an event.
 *
 *   window.vintedReloadPage()
 *       Navigates this tab back to https://www.vinted.co.uk/items/new from inside the page. Works from an error
 *       page because the page's own JavaScript still runs there. Hosts can equally use the browser plugin's own
 *       navigation instead. The probe is lost on navigation, so inject it again afterwards.
 */
(() => {
  'use strict';

  const ERROR_TEXT = /server error|something went wrong|technical issues|try reloading the page|we.?re experiencing/i;
  const FORM_URL = 'https://www.vinted.co.uk/items/new';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const outsideCookieBanner = (el) => !el.closest('#onetrust-consent-sdk, #onetrust-banner-sdk, #onetrust-pc-sdk');

  function notifyHost(detail) {
    try {
      const msg = { ...detail, at: Date.now() };
      if (window.mobileApp && typeof window.mobileApp.postMessage === 'function') window.mobileApp.postMessage({ detail: msg });
      if (window.AndroidBridge && typeof window.AndroidBridge.postMessage === 'function') window.AndroidBridge.postMessage(JSON.stringify(msg));
      window.dispatchEvent(new CustomEvent('vinted-draft-event', { detail: msg }));
    } catch (e) { /* never throw into the host */ }
  }

  function pageStatus() {
    try {
      const path = location.pathname.replace(/\d{6,}/g, '<id>');
      const base = { path, title: document.title, viewportWidth: window.innerWidth };

      const hasForm = !!(document.getElementById('title') &&
        document.querySelector('input[data-testid="add-photos-input"], input[type="file"][name="photos"]'));
      if (hasForm) return { state: 'ready', reason: 'listing form present', ...base };

      const passwordField = [...document.querySelectorAll('input[type="password"]')].some(visible);
      if (passwordField || /\/(login|signup|session)/i.test(location.pathname)) {
        return { state: 'login_wall', reason: passwordField ? 'password field visible' : 'login or sign-up path', ...base };
      }

      const bits = [...document.querySelectorAll('h1, h2, h3, p, [role="alert"]')]
        .filter((e) => visible(e) && outsideCookieBanner(e))
        .map((e) => (e.innerText || '').trim().replace(/\s+/g, ' '))
        .filter(Boolean);
      const headline = bits[0] || '';
      const reloadButton = [...document.querySelectorAll('button, a, [role="button"]')]
        .find((e) => visible(e) && outsideCookieBanner(e) && /^\s*reload\s*$/i.test(e.innerText || ''));

      const matched = bits.find((t) => ERROR_TEXT.test(t));
      if (matched) return { state: 'error_page', reason: 'error text on page', headline: matched.slice(0, 80), hasReloadButton: !!reloadButton, ...base };
      if (reloadButton) return { state: 'error_page', reason: 'Reload button and no form', headline: headline.slice(0, 80), hasReloadButton: true, ...base };

      return { state: 'loading', reason: 'no form and no recognised error yet', headline: headline.slice(0, 80), hasReloadButton: false, ...base };
    } catch (e) {
      return { state: 'loading', reason: 'probe error: ' + String(e && e.message), path: location.pathname, title: document.title };
    }
  }

  // Polls, then sends exactly one final event. An error page must be seen twice (about a second apart)
  // before it is reported, so a page that is still rendering is not mistaken for an error.
  async function checkPage({ timeoutMs = 15000 } = {}) {
    const start = Date.now();
    let errorSeenAt = null;
    let last = pageStatus();
    while (Date.now() - start < timeoutMs) {
      last = pageStatus();
      if (last.state === 'ready' || last.state === 'login_wall') break;
      if (last.state === 'error_page') {
        if (errorSeenAt === null) errorSeenAt = Date.now();
        else if (Date.now() - errorSeenAt >= 1000) break;
      } else {
        errorSeenAt = null;
      }
      await sleep(400);
    }
    const state = last.state === 'loading' ? 'timeout' : last.state;
    const out = { type: 'vinted:pageStatus', final: true, ...last, state, waitedMs: Date.now() - start };
    notifyHost(out);
    return out;
  }

  window.vintedPageStatus = pageStatus;
  window.vintedCheckPage = checkPage;
  window.vintedReloadPage = () => { window.location.assign(FORM_URL); };
})();