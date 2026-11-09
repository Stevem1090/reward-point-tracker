import type { Analysis } from './analysis';
import { analysisToDraft } from './analysis';
import { rotateImage, type VintedImage } from './imageResize';
import { arrangeFromPlan, originalArrangement, type ArrangedPhoto } from './photos';
import { VINTED_REFERENCE as ref } from './reference';
import { validateForApproval, type DraftItem } from './validate';

export const MAX_ITEMS = 25;
export const MAX_PARALLEL_ANALYSIS = 1;
export const PAUSE_BETWEEN_MS = 15_000;
export const SAVE_TIMEOUT_MS = 120_000;

/** £ added to Vinted's "Optimal" price when no custom price is typed. */
export const DEFAULT_PRICE_UPLIFT = 0.5;
const UPLIFT_KEY = 'vinted-price-uplift-v1';
export function loadPriceUplift(): number {
  const raw = localStorage.getItem(UPLIFT_KEY);
  const v = Number(raw);
  return raw != null && raw.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : DEFAULT_PRICE_UPLIFT;
}
export const savePriceUplift = (v: number) => localStorage.setItem(UPLIFT_KEY, String(v));

export type BatchStatus =
  | 'queued' | 'analysing' | 'analysis_failed' | 'needs_review' | 'approved'
  | 'running' | 'drafted' | 'failed' | 'unknown';

export type BatchItem = {
  id: string;
  createdAt: number;
  /** Original photos in the order added (EXIF orientation baked in). Never rotated in place, so undo is always possible. */
  images: VintedImage[];
  /** Final photo order and rotation (unset = original order, no rotation). */
  photos?: ArrangedPhoto[];
  /** Seller changed order/rotation by hand: re-analysis must not touch it. */
  photosLocked?: boolean;
  notes: string;
  hints: string;
  status: BatchStatus;
  analysis?: Analysis;
  title: string;
  description: string;
  conditionId: number | null;
  /** Brand chosen in review. brandId 0 = custom brand not in the reference list (matched by name on Vinted). */
  brandId?: number | null;
  brandName?: string;
  /** Seller confirmed "No brand" in review. */
  noBrand?: boolean;
  /** Manual parcel override (1 Small, 2 Medium, 3 Large). Unset = Vinted recommended. */
  packageId?: 1 | 2 | 3;
  /** Parcel the script actually used, from its report. */
  parcel?: { id: number; name: string; source: string };
  /** Custom price typed in review. Empty = Vinted's Optimal price plus the uplift, set at drafting time. */
  price: string;
  /** Price the script actually used, from its report (also filled by dry runs). */
  priceResult?: { value: number; source: string; optimal?: number; uplift?: number };
  error?: string;
  dryRun?: 'ok' | 'failed';
  draftId?: string | number;
  draftedAt?: number;
};

export const draftLink = (id: string | number) => `https://www.vinted.co.uk/items/${id}/edit`;

export function newItem(images: VintedImage[], notes: string, hints: string): BatchItem {
  return {
    id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(), images, notes, hints, status: 'queued',
    title: '', description: '', conditionId: null, price: '',
  };
}

/** Fill editable fields from a fresh analysis. A custom price typed by hand is kept. */
export function applyAnalysis(it: BatchItem, a: Analysis): BatchItem {
  return {
    ...it, analysis: a, status: 'needs_review', error: undefined,
    title: a.title, description: a.description, conditionId: a.conditionId,
    brandId: a.brandId, brandName: a.brandId != null ? (ref.brands.main as Record<string, string>)[String(a.brandId)] : '', noBrand: false,
    photos: it.photosLocked ? it.photos : arrangeFromPlan(a.photos, arrangement(it).map((p) => p.src)),
  };
}

/** Current photo arrangement. */
export const arrangement = (it: BatchItem): ArrangedPhoto[] => it.photos ?? originalArrangement(it.images.length);

/** Seller's own change: lock it so re-analysis keeps it. */
export const setPhotos = (it: BatchItem, photos: ArrangedPhoto[]): BatchItem => ({ ...it, photos, photosLocked: true });

/** Back to the original photos, order and rotation (locked, so re-analysis keeps it). */
export const resetPhotos = (it: BatchItem): BatchItem => ({ ...it, photos: originalArrangement(it.images.length), photosLocked: true });

/** "Re-order photos again": apply the AI plan to the photos currently kept. */
export const replanPhotos = (it: BatchItem): BatchItem =>
  ({ ...it, photosLocked: false, photos: arrangeFromPlan(it.analysis?.photos ?? null, arrangement(it).map((p) => p.src)) });

/** Photos in final order (unrotated originals). Used for counts and validation. */
export const orderedImages = (it: BatchItem): VintedImage[] =>
  arrangement(it).map((p, i) => ({ ...it.images[p.src], name: `photo-${i + 1}.jpg` }));

/** Payload images: final order, each rotated from its ORIGINAL copy. First = cover. */
export const finalImages = (it: BatchItem): Promise<VintedImage[]> =>
  Promise.all(arrangement(it).map((p, i) => rotateImage(it.images[p.src], p.rotate, `photo-${i + 1}.jpg`)));

/** Apply description regeneration to the latest item, never overwrite any other edits. */
export function applyDescription(it: BatchItem, description: string): BatchItem {
  return { ...it, description, status: it.status === 'approved' ? 'needs_review' : it.status };
}

/** Title as Vinted stores it: single spaces, no leading/trailing space. */
export const cleanTitle = (s: string) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Description as Vinted stores it. Vinted tidies stray spaces and line breaks, so text sent
 * with them reads back different and the script's check sees it as "drifting".
 */
export const cleanDescription = (s: string) =>
  String(s ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Brand part of the payload: a picked brand, or "List without brand" only when confirmed or none was visible. */
function brandFields(it: BatchItem): Partial<DraftItem> {
  if (it.brandId != null) return { brandId: it.brandId, brandName: cleanTitle(it.brandName ?? '') || undefined, noBrand: undefined };
  const noBrand = !!it.noBrand || it.analysis?.brandStatus === 'none_visible';
  return { brandId: undefined, brandName: undefined, noBrand: noBrand || undefined };
}

const PARCEL_SOURCE: Record<string, string> = { vinted: 'Vinted recommended', explicit: 'chosen by you', fallback: 'no recommendation shown' };
export const parcelLabel = (p?: { name: string; source: string }) => p ? `Parcel: ${p.name} (${PARCEL_SOURCE[p.source] ?? p.source})` : '';

/** "£4.50 (Vinted Optimal + £0.50)" or "£6.00 (your price)". */
export const priceLabel = (p?: { value: number; source: string; uplift?: number }) =>
  !p ? '' : p.source === 'custom' ? `£${p.value.toFixed(2)} (your price)` : `£${p.value.toFixed(2)} (Vinted Optimal + £${(p.uplift ?? DEFAULT_PRICE_UPLIFT).toFixed(2)})`;

export function toDraft(it: BatchItem, uplift = loadPriceUplift()): Partial<DraftItem> {
  if (!it.analysis) return {};
  return {
    ...analysisToDraft(it.analysis, it.id, orderedImages(it), it.price ? Number(it.price) : null),
    title: cleanTitle(it.title), description: cleanDescription(it.description), conditionId: it.conditionId ?? undefined,
    ...brandFields(it),
    packageId: it.packageId ?? undefined,
    priceUplift: uplift !== DEFAULT_PRICE_UPLIFT ? uplift : undefined,
  };
}

const FIELD_VALUE_KEY: Record<string, string> = {
  category: 'category', title: 'title', brand: 'brand', size: 'size', condition: 'condition',
  colours: 'colours', material: 'material', price: 'price',
};

/**
 * Turn the script's report into a readable problem. For "still drifting", name the fields that
 * kept changing (from the last "pass N re-applying: …" step) and what Vinted showed.
 */
export function describeReportErrors(report: { errors?: unknown[]; steps?: unknown[]; finalValues?: Record<string, unknown> }, draft?: Partial<DraftItem>): string {
  const errs = (Array.isArray(report.errors) ? report.errors : []).map((e: any) =>
    typeof e === 'string' ? e : (e?.field ?? e?.message ?? JSON.stringify(e)));
  const steps = (Array.isArray(report.steps) ? report.steps : []).map(String);
  const last = [...steps].reverse().find((s) => /^pass \d+ re-applying:/.test(s));
  const fields = last ? last.replace(/^pass \d+ re-applying:\s*/, '').split(',').map((s) => s.trim()).filter(Boolean) : [];
  const fv = report.finalValues ?? {};
  const want: Record<string, unknown> = {
    title: draft?.title, description: draft?.description, brand: draft?.brandName, price: draft?.price,
    colours: draft?.colourIds ? `${draft.colourIds.length} colour(s)` : undefined,
    material: draft?.materialIds ? `${draft.materialIds.length} material(s)` : undefined,
  };
  const detail = fields.map((f) => {
    const key = FIELD_VALUE_KEY[f];
    const shown = key ? fv[key] : undefined;
    const parts = [f];
    if (want[f] != null && f !== 'description') parts.push(`wanted "${want[f]}"`);
    if (shown != null) parts.push(`Vinted shows "${shown || 'nothing'}"`);
    return parts.join(' – ');
  });
  return errs.map((e) => /still drifting/.test(e) && detail.length ? `${e} (kept changing: ${detail.join('; ')})` : e).join(', ');
}

export const approvalErrors = (it: BatchItem) =>
  it.analysis ? validateForApproval(toDraft(it), { flags: it.analysis.flags }) : ['Not analysed yet'];

/**
 * After reopening the app: an item that was mid-save may or may not exist on Vinted, so it
 * becomes "unknown" (check by hand). Interrupted analyses go back in the queue.
 */
export function recoverAfterRestart(items: BatchItem[]): BatchItem[] {
  return items.map((it) =>
    it.status === 'running' ? { ...it, status: 'unknown', error: 'The app closed while this item was being saved. Check your Vinted drafts.' }
      : it.status === 'analysing' ? { ...it, status: 'queued' } : it);
}

export const canAdd = (items: BatchItem[]) => items.length < MAX_ITEMS;
export const runnable = (items: BatchItem[]) => items.filter((i) => i.status === 'approved');

// ---------- Vinted error-page recovery ----------
export type PageState = 'ready' | 'error_page' | 'login_wall' | 'timeout';
export const PROBE_TIMEOUT_MS = 15_000;
/** Waits before each reload in the recovery ladder: reload now, then 10s, 30s, 60s, 120s. */
export const LADDER_WAITS_MS = [0, 10_000, 30_000, 60_000, 120_000];
/** After the whole ladder fails, the batch pauses and tries the ladder once more on its own after this. */
export const AUTO_RETRY_AFTER_MS = 5 * 60_000;
/** Same item may be reloaded and retried this many times if it broke before saving. */
export const MAX_ITEM_RETRIES = 2;
export const RECOVERY_PAUSE_MS = 30_000;
export const CLEAN_ITEMS_TO_RELAX = 3;

/** About ±20% random jitter. */
export const jitter = (ms: number, rnd = Math.random()) => Math.round(ms * (0.8 + 0.4 * rnd));

/** What to do after a page check. */
export const pageAction = (state: PageState | string): 'go' | 'retry' | 'login' =>
  state === 'ready' ? 'go' : state === 'login_wall' ? 'login' : 'retry';

/** Pause before the next item: at least 30s after a recovery, until 3 clean items have gone through. */
export const pauseBetween = (configuredMs: number, cleanSinceRecovery: number | null) =>
  cleanSinceRecovery != null && cleanSinceRecovery < CLEAN_ITEMS_TO_RELAX ? Math.max(configuredMs, RECOVERY_PAUSE_MS) : configuredMs;

/** Diagnostics from the script show none of the form fields exist. */
export const noFormFields = (diag: any) => !!diag?.fields && Object.values(diag.fields).every((v) => !v);

/**
 * An item that broke BEFORE the saving step can be safely reloaded and retried when Vinted was
 * showing an error page or the form never appeared. Never once saving has started.
 */
export const shouldRetryItem = (o: { savingReached: boolean; pageState?: string; diagnostics?: any; retries: number }) =>
  !o.savingReached && o.retries < MAX_ITEM_RETRIES && (o.pageState === 'error_page' || noFormFields(o.diagnostics));

// ---------- Local storage on this phone (IndexedDB: photos are too big for localStorage) ----------
const DB = 'vinted-batch-v1';
const STORE = 'items';
const db = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void) => {
  const d = await db();
  return new Promise<T | undefined>((res, rej) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => res(req ? req.result : undefined);
    t.onerror = () => rej(t.error);
  });
};
export const loadItems = async () =>
  ((await tx<BatchItem[]>('readonly', (s) => s.getAll() as IDBRequest<BatchItem[]>)) ?? []).sort((a, b) => a.createdAt - b.createdAt);
export const putItem = (it: BatchItem) => tx('readwrite', (s) => { s.put(it); });
export const deleteItem = (id: string) => tx('readwrite', (s) => { s.delete(id); });
