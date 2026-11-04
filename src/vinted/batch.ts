import type { Analysis } from './analysis';
import { analysisToDraft } from './analysis';
import type { VintedImage } from './imageResize';
import { validateForApproval, type DraftItem } from './validate';

export const MAX_ITEMS = 25;
export const MAX_PARALLEL_ANALYSIS = 2;
export const PAUSE_BETWEEN_MS = 30_000;
export const SAVE_TIMEOUT_MS = 120_000;

export type BatchStatus =
  | 'queued' | 'analysing' | 'analysis_failed' | 'needs_review' | 'approved'
  | 'running' | 'drafted' | 'failed' | 'unknown';

export type BatchItem = {
  id: string;
  createdAt: number;
  images: VintedImage[];
  notes: string;
  hints: string;
  status: BatchStatus;
  analysis?: Analysis;
  title: string;
  description: string;
  conditionId: number | null;
  price: string;
  priceConfirmed: boolean;
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
    title: '', description: '', conditionId: null, price: '', priceConfirmed: false,
  };
}

/** Fill editable fields from a fresh analysis. Price always needs confirming again. */
export function applyAnalysis(it: BatchItem, a: Analysis): BatchItem {
  return {
    ...it, analysis: a, status: 'needs_review', error: undefined,
    title: a.title, description: a.description, conditionId: a.conditionId,
    price: a.suggestedPrice != null ? String(a.suggestedPrice) : '', priceConfirmed: false,
  };
}

export function toDraft(it: BatchItem): Partial<DraftItem> {
  if (!it.analysis) return {};
  return {
    ...analysisToDraft(it.analysis, it.id, it.images, it.price ? Number(it.price) : null),
    title: it.title, description: it.description, conditionId: it.conditionId ?? undefined,
  };
}

export const approvalErrors = (it: BatchItem) =>
  it.analysis ? validateForApproval(toDraft(it), { priceConfirmed: it.priceConfirmed, flags: it.analysis.flags }) : ['Not analysed yet'];

/** "Accept all suggested prices": only items awaiting review with an unconfirmed AI price. */
export function acceptAllPrices(items: BatchItem[]): BatchItem[] {
  return items.map((it) =>
    it.status === 'needs_review' && !it.priceConfirmed && it.analysis?.suggestedPrice != null
      ? { ...it, price: String(it.analysis.suggestedPrice), priceConfirmed: true }
      : it);
}

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

/** Should the batch stop? Unknown saves, login walls and bot checks always stop it. */
export function blockerFor(probe: { hasTitleField: boolean; botCheck: boolean; loginWall: boolean; openInApp: boolean } | null): string | null {
  if (!probe) return 'Could not check the Vinted page';
  if (probe.botCheck) return 'Vinted is showing a bot check';
  if (probe.loginWall) return 'You are logged out of Vinted';
  if (probe.openInApp) return 'Vinted is asking to open its app';
  if (!probe.hasTitleField) return 'The Vinted listing form did not load';
  return null;
}

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
