import { InAppBrowser } from '@capgo/inappbrowser';
import type { PluginListenerHandle } from '@capacitor/core';
import pluginPkg from '@capgo/inappbrowser/package.json';
import scriptText from './vinted-create-draft.js?raw';
import probeText from './vinted-page-probe.js?raw';

export const VINTED_NEW_URL = 'https://www.vinted.co.uk/items/new';
export const VINTED_SCRIPT = scriptText;
/** Standalone page probe (black-box asset): defines vintedCheckPage / vintedReloadPage. Lost on every navigation. */
export const PAGE_PROBE = probeText;
/** Desktop Chrome UA: the script was only tested on Vinted's desktop layout. */
export const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let webviewId: string | undefined;

/** Fraction of the screen given to Vinted (lower part). The app stays visible above it. */
export type DockSize = 'small' | 'large';
const FRACTION: Record<DockSize, number> = { small: 0.45, large: 0.62 };

/**
 * Plugin 8.6.14 on Android: width/height/x/y are dp (= CSS px here). The dialog window has no
 * gravity set, so Android centres it and x/y are offsets from the centre. We keep full width
 * (>= 360px viewport) and push it down so it sits on the bottom edge.
 */
export function dockRect(size: DockSize) {
  const W = Math.max(360, Math.round(window.innerWidth));
  const H = Math.round(window.screen?.height || window.innerHeight);
  const height = Math.round(H * FRACTION[size]);
  return { width: W, height, x: 0, y: Math.round((H - height) / 2) };
}

export const resizeVinted = (size: DockSize) =>
  InAppBrowser.updateDimensions({ ...dockRect(size), id: webviewId } as any);
export const hideVinted = () => InAppBrowser.hide({ id: webviewId });
export const showVinted = () => InAppBrowser.show({ id: webviewId });

export async function openVinted(size: DockSize = 'small') {
  // Plugin 8.6.x: a "User-Agent" header sets the WebView UA string; wide viewport is on by default.
  const { id } = await InAppBrowser.openWebView({
    url: VINTED_NEW_URL,
    title: 'Vinted',
    headers: { 'User-Agent': DESKTOP_UA },
    preventDeeplink: true,
    captureConsoleLogs: true,
    isPresentAfterPageLoad: false,
    ...dockRect(size),
  } as any);
  webviewId = id;
  return id;
}

export const exec = (code: string) => InAppBrowser.executeScript({ code, id: webviewId });
export const goToNew = () => InAppBrowser.setUrl({ url: VINTED_NEW_URL, id: webviewId });
export const closeVinted = () => InAppBrowser.close().catch(() => {});
export const pluginVersion = async () => pluginPkg.version;

export type Handlers = {
  onMessage: (detail: Record<string, any>) => void;
  onUrl: (url: string) => void;
  onLoaded: () => void;
  onConsole: (level: string, message: string) => void;
  onClose: () => void;
};

export async function listen(h: Handlers): Promise<() => void> {
  const subs: PluginListenerHandle[] = await Promise.all([
    InAppBrowser.addListener('messageFromWebview', (e) => e.detail && h.onMessage(e.detail)),
    InAppBrowser.addListener('urlChangeEvent', (e) => h.onUrl(e.url)),
    InAppBrowser.addListener('browserPageLoaded', () => h.onLoaded()),
    InAppBrowser.addListener('consoleMessage', (e: any) => h.onConsole(e.level, e.message ?? '')),
    InAppBrowser.addListener('closeEvent', () => h.onClose()),
  ]);
  return () => subs.forEach((s) => s.remove());
}

const CHUNK = 200_000;

/** Injection order: item (images chunked if needed) -> script (auto-runs). Returns measurements. */
export async function injectAndRun(item: { images: { base64: string }[] } & Record<string, any>, saveDraft: boolean, log: (m: string) => void) {
  const { images, ...rest } = item;
  const full = JSON.stringify(item);
  const stats = { payloadBytes: full.length, mode: 'single' as 'single' | 'chunked', calls: 0, singleMs: 0, chunkMs: 0, singleError: '' };
  const setItem = (json: string) => `window.__VINTED_ITEM__ = ${json}; window.__VINTED_OPTIONS__ = { saveDraft: ${saveDraft} };`;

  const t0 = performance.now();
  try {
    await exec(setItem(full));
    stats.calls = 1;
    stats.singleMs = Math.round(performance.now() - t0);
    log(`Item set in one call (${(full.length / 1024).toFixed(0)} KB, ${stats.singleMs} ms)`);
  } catch (e: any) {
    stats.singleError = e?.message || String(e);
    log(`Single call failed after ${Math.round(performance.now() - t0)} ms: ${stats.singleError}. Falling back to chunks.`);
    stats.mode = 'chunked';
    const t1 = performance.now();
    await exec('window.__VINTED_IMG_CHUNKS__ = [];');
    stats.calls = 1;
    for (let i = 0; i < images.length; i++) {
      const b = images[i].base64;
      await exec(`window.__VINTED_IMG_CHUNKS__[${i}] = '';`);
      for (let o = 0; o < b.length; o += CHUNK) {
        await exec(`window.__VINTED_IMG_CHUNKS__[${i}] += ${JSON.stringify(b.slice(o, o + CHUNK))};`);
        stats.calls++;
      }
    }
    const meta = JSON.stringify({ ...rest, images: images.map((im: any) => ({ name: im.name, type: im.type })) });
    await exec(`(() => { const it = ${meta}; it.images.forEach((im, i) => { im.base64 = window.__VINTED_IMG_CHUNKS__[i]; }); window.__VINTED_IMG_CHUNKS__ = null; ${setItem('it')} })();`);
    stats.calls += 2;
    stats.chunkMs = Math.round(performance.now() - t1);
    log(`Item set in ${stats.calls} chunked calls (${stats.chunkMs} ms)`);
  }
  await exec(VINTED_SCRIPT);
  log('Script injected (auto-run)');
  return stats;
}
