import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RotateCcw, RotateCw, X } from 'lucide-react';
import { movePhoto, PHOTO_FLAGS, ROLE_LABEL, rotateBy, type ArrangedPhoto } from '@/vinted/photos';
import { ArrowLeft, Loader2, Pause, Play, Plus, RefreshCw, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { isNativeApp } from '@/lib/native/platform';
import { toast } from '@/lib/toast';
import { resizeForVinted } from '@/vinted/imageResize';
import { analysePhotos } from '@/vinted/analysis';
import { writingWarnings } from '@/vinted/writing';
import { allowedConditions } from '@/vinted/validate';
import { VINTED_REFERENCE } from '@/vinted/reference';
import { exec, goToNew, hideVinted, injectAndRun, listen, openVinted, PAGE_PROBE, resizeVinted, showVinted, type DockSize } from '@/vinted/browser';
import {
  applyAnalysis, applyDescription, approvalErrors, canAdd, AUTO_RETRY_AFTER_MS, jitter, LADDER_WAITS_MS, MAX_ITEM_RETRIES, pageAction, pauseBetween, PROBE_TIMEOUT_MS, shouldRetryItem, DEFAULT_PRICE_UPLIFT, deleteItem, draftLink, loadItems, loadPriceUplift, MAX_ITEMS,
  MAX_PARALLEL_ANALYSIS, newItem, PAUSE_BETWEEN_MS, priceLabel, putItem, recoverAfterRestart, runnable, SAVE_TIMEOUT_MS, savePriceUplift, toDraft, finalImages, arrangement, setPhotos, resetPhotos, replanPhotos, describeReportErrors, parcelLabel, type BatchItem,
} from '@/vinted/batch';

const STATUS: Record<BatchItem['status'], string> = {
  queued: 'Waiting for AI', analysing: 'Analysing…', analysis_failed: 'Analysis failed', needs_review: 'Needs review',
  approved: 'Approved', running: 'Sending…', drafted: 'Draft saved', failed: 'Failed', unknown: 'Unknown – check Vinted',
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Outcome = { kind: 'saved'; draftId: any } | { kind: 'notSaved'; reason: string } | { kind: 'dryOk' } | { kind: 'fatal'; reason: string; diagnostics?: any } | { kind: 'timeout' };

export default function VintedLister() {
  const native = isNativeApp();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newNotes, setNewNotes] = useState('');
  const [newHints, setNewHints] = useState('');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [confirmRun, setConfirmRun] = useState(false);
  const [filter, setFilter] = useState<'all' | 'review' | 'ready' | 'saved'>('all');
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState('');
  const [steps, setSteps] = useState<{ step: string; ok?: boolean; done: number; total: number }[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ dry: boolean; done: BatchItem[]; failed: BatchItem[]; stopped: string | null; recovered: number } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [dock, setDock] = useState<DockSize>('small');
  const [hidden, setHidden] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [uplift, setUplift] = useState(() => String(loadPriceUplift()));

  const itemsRef = useRef(items); itemsRef.current = items;
  const analysingIds = useRef(new Set<string>());
  const pausedRef = useRef(false);
  const stopRef = useRef(false);
  const currentId = useRef<string | null>(null);
  const lastParcel = useRef<{ id: string; parcel: any } | null>(null);
  const lastPrice = useRef<{ id: string; price: any } | null>(null);
  const waiter = useRef<((o: Outcome) => void) | null>(null);
  const pageWaiter = useRef<((p: any) => void) | null>(null);
  const savingReached = useRef(false);
  const recoveries = useRef(0);
  /** Clean items since the last recovery (null = no recent recovery, normal pause). */
  const cleanSince = useRef<number | null>(null);
  const recoveredThisItem = useRef(false);
  const wakeLock = useRef<any>(null);

  const save = useCallback((it: BatchItem) => {
    setItems((p) => p.map((x) => (x.id === it.id ? it : x)));
    putItem(it).catch(() => toast('Could not save on this phone'));
  }, []);
  const patch = (id: string, o: Partial<BatchItem>) => {
    const it = itemsRef.current.find((x) => x.id === id);
    if (it) save({ ...it, ...o });
  };

  // Load saved batch and recover from an interrupted session.
  useEffect(() => {
    loadItems().then((all) => {
      const rec = recoverAfterRestart(all);
      rec.forEach((r, i) => r !== all[i] && putItem(r));
      setItems(rec); setLoaded(true);
    });
  }, []);

  // Background AI analysis, at most two at a time.
  useEffect(() => {
    if (!loaded) return;
    const free = MAX_PARALLEL_ANALYSIS - analysingIds.current.size;
    items.filter((i) => i.status === 'queued' && !analysingIds.current.has(i.id)).slice(0, Math.max(0, free)).forEach((it) => {
      analysingIds.current.add(it.id);
      save({ ...it, status: 'analysing' });
      analysePhotos(it.images, { notes: it.notes, hints: it.hints, recentOpeners: itemsRef.current.filter((x) => x.id !== it.id && x.description).map((x) => x.description.split('\n')[0]) })
        .then((a) => { const cur = itemsRef.current.find((x) => x.id === it.id); if (cur) save(applyAnalysis(cur, a)); })
        .catch((e) => { const cur = itemsRef.current.find((x) => x.id === it.id); if (cur) save({ ...cur, status: 'analysis_failed', error: e?.message || String(e) }); })
        .finally(() => { analysingIds.current.delete(it.id); setItems((p) => [...p]); });
    });
  }, [items, loaded, save]);

  // Vinted browser messages.
  useEffect(() => {
    if (!native) return;
    let off: (() => void) | undefined;
    listen({
      onMessage: (d) => {
        if (d.type === 'vinted:pageStatus') { if (d.final) pageWaiter.current?.(d); return; }
        if (typeof d.type !== 'string' || !d.type.startsWith('vinted:')) return;
        if (d.itemId != null && String(d.itemId) !== currentId.current) return;
        if (d.type === 'vinted:progress' && d.step === 'saving') savingReached.current = true;
        if (d.type === 'vinted:progress') setSteps((p) => [...p, { step: String(d.step), ok: d.ok, done: Number(d.done) || 0, total: Number(d.total) || 0 }]);
        if (d.type === 'vinted:saveResult') waiter.current?.(d.ok && d.draftId ? { kind: 'saved', draftId: d.draftId } : { kind: 'notSaved', reason: `Vinted refused the save (status ${d.status})` });
        if (d.type === 'vinted:fatal') waiter.current?.({ kind: 'fatal', reason: String(d.error ?? d.message ?? 'Form filling failed'), diagnostics: d.diagnostics });
        if (d.type === 'vinted:report') {
          if (d.parcel && currentId.current) lastParcel.current = { id: currentId.current, parcel: d.parcel };
          if (d.price && currentId.current) lastPrice.current = { id: currentId.current, price: d.price };
          const errs = Array.isArray(d.errors) ? d.errors : [];
          const cur = itemsRef.current.find((x) => x.id === currentId.current);
          const problems = errs.length ? `Field problems: ${describeReportErrors(d, cur ? toDraft(cur) : undefined)}` : '';
          if ((window as any).__batchDry) waiter.current?.(errs.length ? { kind: 'fatal', reason: problems } : { kind: 'dryOk' });
          else if (d.willSave === false || errs.length) waiter.current?.({ kind: 'fatal', reason: problems || 'Vinted form was not ready to save', diagnostics: d.diagnostics });
        }
      },
      onUrl: () => {}, onLoaded: () => {}, onConsole: () => {},
      onClose: () => setBrowserOpen(false),
    }).then((o) => (off = o));
    return () => off?.();
  }, [native]);

  // Keep the screen awake while running.
  useEffect(() => {
    if (!running) { wakeLock.current?.release?.().catch(() => {}); wakeLock.current = null; return; }
    const get = () => (navigator as any).wakeLock?.request('screen').then((l: any) => (wakeLock.current = l)).catch(() => {});
    get();
    const onVis = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [running]);

  const addItem = async () => {
    if (!newFiles.length) { toast('Add at least one photo'); return; }
    if (!canAdd(itemsRef.current)) { toast(`A batch can hold up to ${MAX_ITEMS} items`); return; }
    const images = await Promise.all(newFiles.slice(0, 5).map((f, i) => resizeForVinted(f, i)));
    const it = newItem(images, newNotes.trim(), newHints.trim());
    await putItem(it);
    setItems((p) => [...p, it]);
    setNewFiles([]); setNewNotes(''); setNewHints(''); setAdding(false);
    toast('Item added – the AI is analysing it');
  };
  const remove = async (id: string) => { await deleteItem(id); setItems((p) => p.filter((x) => x.id !== id)); setReviewId(null); };
  const changeUplift = (v: string) => {
    setUplift(v);
    const n = Number(v);
    if (v.trim() && Number.isFinite(n) && n >= 0) savePriceUplift(n);
  };
  const clearFinished = async () => {
    for (const it of itemsRef.current.filter((i) => i.status === 'drafted')) await deleteItem(it.id);
    setItems((p) => p.filter((i) => i.status !== 'drafted'));
  };

  const addLog = (m: string) => setLog((p) => [...p, `${new Date().toLocaleTimeString('en-GB')} ${m}`]);

  /** Inject the page probe and wait for its single final vinted:pageStatus event. */
  const checkPage = async (): Promise<{ state: string; diagnostics?: any }> => {
    const p = new Promise<any>((res) => { pageWaiter.current = res; setTimeout(() => res(null), PROBE_TIMEOUT_MS + 5000); });
    await exec(PAGE_PROBE).catch(() => {});
    await exec(`window.vintedCheckPage && window.vintedCheckPage({ timeoutMs: ${PROBE_TIMEOUT_MS} })`).catch(() => {});
    const r = await p; pageWaiter.current = null;
    const state = r?.state ?? 'timeout';
    addLog(`Page check: ${state}${r?.reason ? ` (${r.reason})` : r ? '' : ' (no answer from the page)'}${r?.headline ? ` – "${r.headline}"` : ''}`);
    return { state };
  };
  const reloadAndCheck = async () => { await goToNew(); await sleep(3000); return checkPage(); };
  const countdownWait = async (ms: number, label: (s: number) => string) => {
    for (let t = Math.ceil(ms / 1000); t > 0 && !stopRef.current; t--) { setCountdown(t); setStatus(label(t)); await sleep(1000); }
    setCountdown(0);
  };

  /** Recovery ladder: reload now, then after ~10s, 30s, 60s, 120s. Nothing is saved yet, so retrying is safe. */
  const runLadder = async (): Promise<'ready' | 'login' | 'stopped' | 'failed'> => {
    const total = LADDER_WAITS_MS.length;
    for (let i = 0; i < total; i++) {
      const wait = jitter(LADDER_WAITS_MS[i]);
      if (wait) await countdownWait(wait, () => `Vinted had a problem. Retrying (${i + 1} of ${total}) in`);
      if (stopRef.current) return 'stopped';
      setStatus(`Vinted had a problem. Retrying (${i + 1} of ${total}) now…`);
      addLog(`Recovery attempt ${i + 1} of ${total}${wait ? ` after ${Math.round(wait / 1000)}s` : ''}: reloading`);
      const r = await reloadAndCheck();
      if (stopRef.current) return 'stopped';
      const a = pageAction(r.state);
      if (a === 'go') { recoveries.current++; cleanSince.current = 0; recoveredThisItem.current = true; addLog('Recovered – Vinted form is back'); return 'ready'; }
      if (a === 'login') return 'login';
    }
    return 'failed';
  };

  /** Preflight before every item: open the form, check it, recover if Vinted shows an error. */
  const ensureReady = async (): Promise<'ready' | 'login' | 'stopped'> => {
    const first = pageAction((await reloadAndCheck()).state);
    if (first === 'go') return 'ready';
    if (first === 'login') return 'login';
    let res = await runLadder();
    let autoUsed = false;
    while (res === 'failed') {
      addLog('All retries failed – batch paused, items stay queued');
      pausedRef.current = true; setPaused(true);
      const msg = 'Vinted keeps showing an error. Check Vinted, then tap Resume';
      setStatus(msg);
      const start = Date.now();
      while (pausedRef.current && !stopRef.current && (autoUsed || Date.now() - start < AUTO_RETRY_AFTER_MS)) { setStatus(msg); await sleep(500); }
      if (stopRef.current) return 'stopped';
      if (pausedRef.current) { autoUsed = true; pausedRef.current = false; setPaused(false); addLog('Trying again on its own after 5 minutes'); }
      else addLog('Resumed by you');
      res = await runLadder();
    }
    return res;
  };

  const runBatch = async () => {
    setConfirmRun(false);
    const queue = runnable(itemsRef.current);
    if (!queue.length) return;
    const dry = false;
    (window as any).__batchDry = dry;
    stopRef.current = false; pausedRef.current = false; setPaused(false);
    setRunning(true); setStopReason(null); setSummary(null); setLog([]);
    recoveries.current = 0; cleanSince.current = null;
    const done: BatchItem[] = [], failed: BatchItem[] = [];
    let stopped: string | null = null;
    try {
      if (!browserOpen) { setStatus('Opening Vinted…'); await openVinted(dock); setBrowserOpen(true); setHidden(false); await sleep(5000); }
      for (let n = 0; n < queue.length; n++) {
        if (stopRef.current) { stopped = 'Stopped by you'; break; }
        while (pausedRef.current && !stopRef.current) { setStatus('Paused'); await sleep(500); }
        if (stopRef.current) { stopped = 'Stopped by you'; break; }
        const it = itemsRef.current.find((x) => x.id === queue[n].id);
        if (!it || it.status !== 'approved') continue;
        setStatus(`Item ${n + 1} of ${queue.length}: ${it.title}`); setSteps([]);
        recoveredThisItem.current = false;
        let ready = await ensureReady();
        let o: Outcome = { kind: 'timeout' };
        let retries = 0;
        for (;;) {
          if (ready === 'stopped') break;
          if (ready === 'login') break;
          currentId.current = it.id; savingReached.current = false;
          if (!dry) patch(it.id, { status: 'running' });
          const outcome = new Promise<Outcome>((res) => {
            waiter.current = res;
            setTimeout(() => res({ kind: 'timeout' }), SAVE_TIMEOUT_MS);
          });
          const fresh = itemsRef.current.find((x) => x.id === it.id) ?? it;
          try { await injectAndRun({ ...toDraft(fresh), images: await finalImages(fresh) } as any, !dry, () => {}); }
          catch (e: any) { waiter.current?.({ kind: 'fatal', reason: e?.message || String(e) }); }
          o = await outcome; waiter.current = null; currentId.current = null;
          if (o.kind !== 'fatal' || savingReached.current) break;
          const pc = await checkPage();
          if (!shouldRetryItem({ savingReached: savingReached.current, pageState: pc.state, diagnostics: o.diagnostics, retries })) break;
          retries++;
          recoveredThisItem.current = true; cleanSince.current = 0;
          addLog(`Item broke before saving – reloading and retrying the same item (${retries} of ${MAX_ITEM_RETRIES})`);
          setStatus(`Vinted had a problem. Retrying this item (${retries} of ${MAX_ITEM_RETRIES})…`); setSteps([]);
          ready = await ensureReady();
        }
        if (ready === 'stopped') { if (!dry) patch(it.id, { status: 'approved' }); stopped = 'Stopped by you'; break; }
        if (ready === 'login') { if (!dry) patch(it.id, { status: 'approved' }); stopped = 'You are logged out of Vinted. Log in again'; break; }
        if (o.kind === 'saved' && retries) { recoveries.current++; addLog('Item saved after retry'); }
        if (o.kind === 'saved' && !recoveredThisItem.current && cleanSince.current != null) cleanSince.current++;
        addLog(`${it.title}: ${o.kind === 'saved' ? 'saved' : o.kind === 'timeout' ? 'no answer (unknown)' : o.kind === 'dryOk' ? 'dry run ok' : 'failed'}`);
        const cur = itemsRef.current.find((x) => x.id === it.id)!;
        const priceResult = lastPrice.current?.id === it.id ? lastPrice.current.price : cur.priceResult;
        if (o.kind === 'saved') { const s = { ...cur, status: 'drafted' as const, draftId: o.draftId, parcel: lastParcel.current?.id === it.id ? lastParcel.current.parcel : cur.parcel, priceResult, draftedAt: Date.now(), error: undefined }; save(s); done.push(s); }
        else if (o.kind === 'dryOk') { const s = { ...cur, dryRun: 'ok' as const, priceResult, error: undefined }; save(s); done.push(s); }
        else if (o.kind === 'timeout') {
          const s = { ...cur, status: dry ? cur.status : 'unknown' as const, dryRun: dry ? 'failed' as const : cur.dryRun, error: 'No answer from Vinted within 2 minutes. Check your Vinted drafts before retrying.' };
          save(s); failed.push(s); stopped = 'No answer from Vinted – result unknown'; break;
        } else {
          const s = { ...cur, status: dry ? cur.status : 'failed' as const, dryRun: dry ? 'failed' as const : cur.dryRun, error: o.reason };
          save(s); failed.push(s);
        }
        if (n < queue.length - 1 && !stopRef.current) {
          const wait = pauseBetween(PAUSE_BETWEEN_MS, cleanSince.current);
          await countdownWait(wait, () => wait > PAUSE_BETWEEN_MS ? 'Waiting a bit longer after a Vinted problem…' : 'Waiting before the next item…');
        }
      }
    } catch (e: any) { stopped = `Something went wrong: ${e?.message || e}`; }
    setRunning(false); setStatus(''); setCountdown(0); setStopReason(stopped);
    setSummary({ dry, done, failed, stopped, recovered: recoveries.current });
  };

  const setSize = async (s: DockSize) => { setDock(s); await resizeVinted(s).catch(() => {}); };
  const toggleHidden = async () => { await (hidden ? showVinted() : hideVinted()).catch(() => {}); setHidden(!hidden); };

  const review = items.find((i) => i.id === reviewId) ?? null;
  const approved = runnable(items).length;
  const analysing = items.filter((i) => i.status === 'queued' || i.status === 'analysing').length;
  const last = steps[steps.length - 1];
  const pct = last?.total ? Math.round((last.done / last.total) * 100) : 0;
  const FILTERS: { id: typeof filter; label: string; match: (s: BatchItem['status']) => boolean }[] = [
    { id: 'all', label: 'All', match: () => true },
    { id: 'review', label: 'Needs review', match: (s) => s === 'needs_review' || s === 'analysis_failed' || s === 'failed' || s === 'unknown' },
    { id: 'ready', label: 'Ready to send', match: (s) => s === 'approved' || s === 'queued' || s === 'analysing' },
    { id: 'saved', label: 'Saved', match: (s) => s === 'drafted' },
  ];
  const visible = items.filter((i) => FILTERS.find((f) => f.id === filter)!.match(i.status));

  return (
    <div className="container mx-auto max-w-2xl px-3 py-4 space-y-3" style={browserOpen && !hidden ? { paddingBottom: `${dock === 'large' ? 62 : 45}vh` } : undefined}>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11"><Link to="/" aria-label="Back"><ArrowLeft /></Link></Button>
        <h1 className="text-xl font-bold flex-1">Vinted lister</h1>
        <span className="text-sm text-muted-foreground">{items.length}/{MAX_ITEMS}</span>
      </div>

      {!native && <Card><CardContent className="p-3 text-sm text-muted-foreground">You can photograph, add and review items here. Sending them to Vinted runs in the Family Hub Android app, where Vinted opens in a panel at the bottom of this screen.</CardContent></Card>}

      {running && (
        <Card className="sticky top-0 z-10">
          <CardContent className="p-3 space-y-2 text-sm">
            <div className="font-medium">{status}{countdown ? ` ${countdown}s` : ''}</div>
            <Progress value={countdown ? 100 : pct} />
            {last && <div className="text-xs text-muted-foreground">{last.ok === false ? '✕' : '✓'} {last.step}</div>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" onClick={() => { pausedRef.current = !paused; setPaused(!paused); }}>
                {paused ? <><Play className="mr-1 h-4 w-4" />Resume</> : <><Pause className="mr-1 h-4 w-4" />Pause</>}
              </Button>
              <Button variant="destructive" className="h-11" onClick={() => { stopRef.current = true; setStatus('Stopping after this item…'); }}><Square className="mr-1 h-4 w-4" />Stop</Button>
            </div>
            <p className="text-xs text-muted-foreground">Pause and Stop take effect after the current item finishes. Keep this screen open.</p>
            {log.length > 0 && <BatchLog log={log} />}
          </CardContent>
        </Card>
      )}

      {browserOpen && (
        <div className="grid grid-cols-3 gap-2">
          <Button className="h-11" variant={dock === 'small' && !hidden ? 'default' : 'outline'} onClick={() => setSize('small')}>Small</Button>
          <Button className="h-11" variant={dock === 'large' && !hidden ? 'default' : 'outline'} onClick={() => setSize('large')}>Large</Button>
          <Button className="h-11" variant="outline" onClick={toggleHidden}>{hidden ? 'Show' : 'Hide'}</Button>
        </div>
      )}

      {summary && (
        <Card className={summary.stopped ? 'border-destructive' : ''}>
          <CardContent className="p-3 space-y-2 text-sm">
            <div className="font-medium">{summary.dry ? 'Dry run finished' : 'Batch finished'}{summary.stopped ? ` – stopped: ${summary.stopped}` : ''}</div>
            <div>{summary.done.length} {summary.dry ? 'filled in fine' : 'drafts saved'} · {summary.failed.length} problems</div>
            {summary.dry
              ? summary.done.map((d) => <div key={d.id} className="truncate">{d.title}{d.priceResult ? ` – ${priceLabel(d.priceResult)}` : ''}</div>)
              : summary.done.map((d) => (
                <div key={d.id} className="min-w-0">
                  <a href={draftLink(d.draftId!)} target="_blank" rel="noreferrer" className="text-primary underline truncate">{d.title}</a>
                  {d.priceResult && <span className="text-muted-foreground"> – {priceLabel(d.priceResult)}</span>}
                </div>
              ))}
            {summary.failed.map((f) => <div key={f.id} className="text-destructive">{f.title}: {f.error}</div>)}
            <div>Vinted errors recovered: {summary.recovered}</div>
            {log.length > 0 && <BatchLog log={log} />}
            {stopReason && /logged out|bot check|open its app/.test(stopReason) && <p className="text-muted-foreground">Sort this out in the Vinted panel below, then tap Run batch again.</p>}
            <Button variant="ghost" className="h-11" onClick={() => setSummary(null)}>Close</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button className="h-11" onClick={() => setAdding(true)} disabled={!canAdd(items) || running}><Plus className="mr-1 h-4 w-4" />Add item</Button>
        <Button className="h-11" variant="secondary" disabled={!approved || running || !native} onClick={() => setConfirmRun(true)}><Play className="mr-1 h-4 w-4" />Run batch ({approved})</Button>
      </div>
      {analysing > 0 && <p className="text-xs text-muted-foreground">AI is analysing {analysing} item{analysing > 1 ? 's' : ''} (two at a time). Keep this screen open.</p>}

      <Card><CardContent className="p-3 flex items-center gap-3 text-sm">
        <Label htmlFor="uplift" className="flex-1">Price uplift – added to Vinted's "Optimal" price when you haven't typed one</Label>
        <span>£</span>
        <Input id="uplift" className="w-20 h-11" inputMode="decimal" value={uplift} onChange={(e) => changeUplift(e.target.value)} />
      </CardContent></Card>

      {loaded && !items.length && <Card><CardContent className="p-4 text-sm text-muted-foreground">No items yet. Tap Add item, pick up to 5 photos and add any notes about flaws.</CardContent></Card>}

      {items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <Button key={f.id} size="sm" className="h-11 shrink-0" variant={filter === f.id ? 'default' : 'outline'} onClick={() => setFilter(f.id)}>
              {f.label} ({items.filter((i) => f.match(i.status)).length})
            </Button>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {visible.map((it) => (
          <li key={it.id}>
            <button className="w-full text-left" onClick={() => setReviewId(it.id)} disabled={running}>
              <Card><CardContent className="p-2 flex gap-3 items-center min-w-0">
                <CoverThumb it={it} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{it.title || it.notes || 'New item'}</div>
                  <div className="text-xs text-muted-foreground">{it.priceResult ? priceLabel(it.priceResult) : it.price ? `£${it.price} (your price)` : `Vinted Optimal + £${Number(uplift || DEFAULT_PRICE_UPLIFT).toFixed(2)}`}{it.dryRun ? ` · dry run ${it.dryRun === 'ok' ? 'OK' : 'failed'}` : ''}</div>
                  {it.error && <div className="text-xs text-destructive truncate">{it.error}</div>}
                  {photoFlags(it).length > 0 && <div className="flex flex-wrap gap-1 pt-1">{photoFlags(it).map((f) => <Badge key={f} variant="outline" className="text-[10px]">{FLAG_LABEL[f] ?? f}</Badge>)}</div>}
                </div>
                <Badge variant={it.status === 'drafted' || it.status === 'approved' ? 'default' : it.status === 'failed' || it.status === 'unknown' || it.status === 'analysis_failed' ? 'destructive' : 'secondary'} className="shrink-0">
                  {it.status === 'analysing' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{STATUS[it.status]}
                </Badge>
              </CardContent></Card>
            </button>
          </li>
        ))}
      </ul>
      {items.some((i) => i.status === 'drafted') && !running && <Button variant="ghost" className="h-11 w-full" onClick={clearFinished}>Clear saved drafts from this list</Button>}

      {/* Add item */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="file" accept="image/*" multiple onChange={(e) => setNewFiles(Array.from(e.target.files ?? []).slice(0, 5))} />
            <p className="text-xs text-muted-foreground">{newFiles.length}/5 photos. Include the size and care labels if you can.</p>
            <Textarea placeholder="Notes: flaws, marks, wear (these always go in the description)" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} maxLength={1000} />
            <Input placeholder="Hints for the AI (optional), e.g. brand is Next" value={newHints} onChange={(e) => setNewHints(e.target.value)} maxLength={300} />
            <Button className="h-11 w-full" onClick={addItem}>Add to batch</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review */}
      <Dialog open={!!review} onOpenChange={(o) => !o && setReviewId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {review && <ReviewForm key={review.id} it={review} onChange={save} onDelete={() => remove(review.id)} onClose={() => setReviewId(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRun} onOpenChange={setConfirmRun}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run {approved} item{approved > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This saves real drafts in your Vinted account. Nothing is published, and nothing is ever deleted automatically. There is a {PAUSE_BETWEEN_MS / 1000} second pause between items, so {approved} item{approved > 1 ? 's' : ''} take{approved > 1 ? '' : 's'} roughly {Math.max(1, Math.round((approved * (SAVE_TIMEOUT_MS / 4 + PAUSE_BETWEEN_MS)) / 60000))} minute{approved > 1 ? 's' : ''}. Keep this screen open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={runBatch}>Save drafts</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReviewForm({ it, onChange, onDelete, onClose }: { it: BatchItem; onChange: (i: BatchItem) => void; onDelete: () => void; onClose: () => void }) {
  const [regenerating, setRegenerating] = useState(false);
  const latest = useRef(it); latest.current = it;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const a = it.analysis;
  const set = (o: Partial<BatchItem>) => onChange({ ...it, ...o, status: it.status === 'approved' ? 'needs_review' : it.status });
  const errors = approvalErrors(it);
  const conds = a?.categoryLeafId != null ? allowedConditions(a.categoryLeafId) : {};
  const done = it.status === 'drafted';
  const warnings = writingWarnings(it.description, it.conditionId, it.notes);
  const regenerate = async () => {
    setRegenerating(true);
    const originalDescription = it.description;
    try {
      const result = await analysePhotos(it.images, { notes: it.notes, hints: it.hints, descriptionOnly: { title: it.title, description: it.description, conditionId: it.conditionId } });
      if (!mounted.current) return;
      if (latest.current.description !== originalDescription) { toast('Your description changed while waiting. Kept your edits – tap regenerate again if needed.'); return; }
      onChange(applyDescription(latest.current, result.description));
    } catch (e) { if (mounted.current) toast(e instanceof Error ? e.message : 'Could not regenerate description'); }
    finally { if (mounted.current) setRegenerating(false); }
  };
  return (
    <div className="space-y-3 text-sm">
      <DialogHeader><DialogTitle>{STATUS[it.status]}</DialogTitle></DialogHeader>
      <PhotoStrip it={it} onChange={(n) => onChange({ ...n, status: it.status === 'approved' ? 'needs_review' : it.status })} readOnly={done} />
      {it.error && <p className="text-destructive">{it.error}</p>}
      {done && it.draftId && <a className="text-primary underline" href={draftLink(it.draftId)} target="_blank" rel="noreferrer">Open draft on Vinted</a>}
      {it.parcel && <p className="text-xs text-muted-foreground">{parcelLabel(it.parcel)}</p>}
      {it.priceResult && <p className="text-xs text-muted-foreground">Price: {priceLabel(it.priceResult)}</p>}
      {it.status === 'unknown' && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={() => onChange({ ...it, status: 'drafted', error: undefined })}>It's in my drafts</Button>
          <Button variant="outline" className="h-11" onClick={() => onChange({ ...it, status: 'approved', error: undefined })}>Not there – retry</Button>
        </div>
      )}
      {it.status === 'failed' && /no price recommendation/i.test(it.error ?? '') && (
        <p className="text-xs text-muted-foreground">Vinted showed no price recommendation for this item. Enter a custom price below, then retry – nothing was saved, so retrying is safe.</p>
      )}
      {it.status === 'failed' && <Button variant="outline" className="h-11 w-full" onClick={() => onChange({ ...it, status: 'approved', error: undefined })}>Try again in next batch</Button>}
      {(it.status === 'analysis_failed' || (a && !done)) && <Button variant="outline" className="h-11 w-full" onClick={() => onChange({ ...it, status: 'queued', error: undefined })}>Analyse again</Button>}

      {a && !done && (
        <>
          {a.flags.filter((f) => f !== 'confirm_condition').length > 0 && <div className="flex flex-wrap gap-1">{a.flags.filter((f) => f !== 'confirm_condition').map((f) => <Badge key={f} variant="outline">{f.replace(/_/g, ' ')}</Badge>)}</div>}
          <Label htmlFor="vinted-title">Title</Label>
          <Input id="vinted-title" value={it.title} onChange={(e) => set({ title: e.target.value })} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="vinted-description">Description</Label>
            <Button variant="outline" className="h-11" disabled={regenerating} onClick={regenerate}>
              {regenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Regenerate description
            </Button>
          </div>
          <Textarea id="vinted-description" rows={4} value={it.description} onChange={(e) => set({ description: e.target.value })} />
          {warnings.length > 0 && <div className="space-y-1 text-xs text-muted-foreground" role="status"><p className="font-medium">Writing checks · optional review</p><ul className="list-disc pl-4">{warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>}
          <Label>Brand</Label>
          {a.brandNameRead && <p className="text-xs text-muted-foreground">Label reads: {a.brandNameRead}</p>}
          {it.brandId == null && (it.noBrand || a.brandStatus === 'none_visible') && <Badge variant="secondary">No brand</Badge>}
          {a.brandStatus === 'not_in_list' && it.brandId == null && !it.noBrand && <p className="text-xs text-destructive">A brand is visible but isn't in the list. Pick one, or confirm "No brand".</p>}
          <div className="flex gap-2">
          <select className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-2" value={it.brandId == null ? '' : String(it.brandId)}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') set({ brandId: null, brandName: '' });
              else if (v === '0') set({ noBrand: false, brandId: 0, brandName: it.brandId === 0 ? it.brandName : (a.brandNameRead ?? '') });
              else set({ noBrand: false, brandId: Number(v), brandName: (VINTED_REFERENCE.brands.main as Record<string, string>)[v] });
            }}>
            <option value="">Choose a brand…</option>
            {Object.entries(VINTED_REFERENCE.brands.main as Record<string, string>).sort((x, y) => x[1].localeCompare(y[1])).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            <option value="0">Other (type it)…</option>
          </select>
          <Button type="button" className="h-11 shrink-0" variant={it.noBrand && it.brandId == null ? 'secondary' : 'outline'}
            onClick={() => set({ noBrand: !(it.noBrand && it.brandId == null), brandId: null, brandName: '' })}>No brand</Button>
          </div>
          {it.brandId === 0 && <Input placeholder="Brand name exactly as on Vinted" value={it.brandName ?? ''} onChange={(e) => set({ brandName: e.target.value })} />}
          <Label>Parcel size</Label>
          <select className="h-11 w-full rounded-md border border-input bg-background px-2" value={it.packageId ?? ''} onChange={(e) => set({ packageId: e.target.value ? Number(e.target.value) as 1 | 2 | 3 : undefined })}>
            <option value="">Vinted recommended</option>
            <option value="1">Small</option>
            <option value="2">Medium</option>
            <option value="3">Large</option>
          </select>
          <Label>Condition</Label>
          <select className="h-11 w-full rounded-md border border-input bg-background px-2" value={it.conditionId ?? ''} onChange={(e) => set({ conditionId: Number(e.target.value) })}>
            {Object.entries(conds).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">{a.conditionReason}</p>
          <Label>Price (£)</Label>
          <Input inputMode="decimal" placeholder="Leave empty" value={it.price} onChange={(e) => set({ price: e.target.value })} />
          <p className="text-xs text-muted-foreground">{it.price ? 'Your custom price will be used.' : `Vinted Optimal + £${loadPriceUplift().toFixed(2)} (set when drafting)`}</p>
          {errors.length > 0 && <ul className="text-destructive text-xs list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          <Button className="h-11 w-full" disabled={errors.length > 0 || it.status === 'approved'} onClick={() => { onChange({ ...it, status: 'approved' }); onClose(); }}>
            {it.status === 'approved' ? 'Approved' : 'Approve'}
          </Button>
        </>
      )}
      <Button variant="ghost" className="h-11 w-full text-destructive" onClick={onDelete}><Trash2 className="mr-1 h-4 w-4" />Remove from batch</Button>
    </div>
  );
}

function BatchLog({ log }: { log: string[] }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer py-2 text-muted-foreground">Batch log ({log.length})</summary>
      <div className="max-h-48 overflow-y-auto space-y-0.5 font-mono break-words">
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </details>
  );
}

const FLAG_LABEL: Record<string, string> = {
  no_full_item_photo: 'No full-item photo', person_visible: 'Person in photo', possible_duplicate_photo: 'Possible duplicate photo',
  photo_quality: 'Blurry or blocked photo', rotation_uncertain: 'Rotation unsure', photo_plan_invalid: 'Photo order not applied',
};
const photoFlags = (it: BatchItem) => (it.analysis?.flags ?? []).filter((f) => PHOTO_FLAGS.includes(f));

function CoverThumb({ it }: { it: BatchItem }) {
  const p = arrangement(it)[0];
  const im = p ? it.images[p.src] : it.images[0];
  return (
    <div className="h-14 w-14 rounded overflow-hidden shrink-0">
      <img src={`data:image/jpeg;base64,${im?.base64}`} alt="" className="h-full w-full object-cover" style={{ transform: `rotate(${p?.rotate ?? 0}deg)` }} />
    </div>
  );
}

function SortablePhoto({ id, p, it, index, total, readOnly, onRotate, onDelete }: {
  id: string; p: ArrangedPhoto; it: BatchItem; index: number; total: number; readOnly: boolean;
  onRotate: (d: 90 | -90) => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: readOnly });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`w-36 shrink-0 space-y-1 ${isDragging ? 'opacity-70' : ''}`}>
      <div {...attributes} {...listeners} className="relative h-36 w-36 overflow-hidden rounded border border-border bg-muted touch-none" aria-label={`Photo ${index + 1} of ${total}, drag to reorder`}>
        <img src={`data:image/jpeg;base64,${it.images[p.src]?.base64}`} alt="" className="h-full w-full object-contain transition-transform" style={{ transform: `rotate(${p.rotate}deg)` }} />
        {index === 0 && <Badge className="absolute left-1 top-1">Cover</Badge>}
      </div>
      <div className="flex flex-wrap gap-1">
        {p.role && <Badge variant="secondary" className="text-[10px]">{ROLE_LABEL[p.role]}</Badge>}
        {p.autoDeg ? <Badge variant="outline" className="text-[10px]">Auto-rotated {p.autoDeg}°</Badge> : null}
        {p.checkRotation && <Badge variant="destructive" className="text-[10px]">Check rotation</Badge>}
      </div>
      {!readOnly && (
        <div className="flex">
          <Button type="button" size="icon" variant="ghost" className="h-11 w-11" aria-label="Rotate left" onClick={() => onRotate(-90)}><RotateCcw className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-11 w-11" aria-label="Rotate right" onClick={() => onRotate(90)}><RotateCw className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-11 w-11" aria-label="Remove photo" disabled={total <= 1} onClick={onDelete}><X className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}

function PhotoStrip({ it, onChange, readOnly }: { it: BatchItem; onChange: (i: BatchItem) => void; readOnly: boolean }) {
  const photos = arrangement(it);
  const ids = photos.map((p) => `p${p.src}`);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const update = (next: ArrangedPhoto[]) => onChange(setPhotos(it, next));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    update(movePhoto(photos, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  };
  const changed = it.photosLocked || photos.length !== it.images.length || photos.some((p, i) => p.src !== i || p.rotate);
  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <SortablePhoto key={ids[i]} id={ids[i]} p={p} it={it} index={i} total={photos.length} readOnly={readOnly}
                onRotate={(d) => update(photos.map((x, j) => (j === i ? rotateBy(x, d) : x)))}
                onDelete={() => update(photos.filter((_, j) => j !== i))} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {changed && <Button type="button" variant="outline" className="h-11" onClick={() => onChange(resetPhotos(it))}>Reset to original order and rotation</Button>}
          {it.photosLocked && it.analysis?.photos && <Button type="button" variant="outline" className="h-11" onClick={() => onChange(replanPhotos(it))}>Re-order photos again</Button>}
        </div>
      )}
      {!readOnly && photos.length > 1 && <p className="text-xs text-muted-foreground">Hold and drag a photo to move it. The first photo is the cover.</p>}
    </div>
  );
}
