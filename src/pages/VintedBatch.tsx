import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Pause, Play, Plus, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { isNativeApp } from '@/lib/native/platform';
import { toast } from '@/lib/toast';
import { resizeForVinted } from '@/vinted/imageResize';
import { analysePhotos } from '@/vinted/analysis';
import { allowedConditions } from '@/vinted/validate';
import { exec, goToNew, hideVinted, injectAndRun, listen, openVinted, PROBE_SCRIPT, resizeVinted, showVinted, type DockSize } from '@/vinted/browser';
import {
  acceptAllPrices, applyAnalysis, approvalErrors, blockerFor, canAdd, deleteItem, draftLink, loadItems, MAX_ITEMS,
  MAX_PARALLEL_ANALYSIS, newItem, PAUSE_BETWEEN_MS, putItem, recoverAfterRestart, runnable, SAVE_TIMEOUT_MS, toDraft, type BatchItem,
} from '@/vinted/batch';

const STATUS: Record<BatchItem['status'], string> = {
  queued: 'Waiting for AI', analysing: 'Analysing…', analysis_failed: 'Analysis failed', needs_review: 'Needs review',
  approved: 'Approved', running: 'Sending…', drafted: 'Draft saved', failed: 'Failed', unknown: 'Unknown – check Vinted',
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Outcome = { kind: 'saved'; draftId: any } | { kind: 'notSaved'; reason: string } | { kind: 'dryOk' } | { kind: 'fatal'; reason: string } | { kind: 'timeout' };

export default function VintedBatch() {
  const native = isNativeApp();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newNotes, setNewNotes] = useState('');
  const [newHints, setNewHints] = useState('');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [confirmRun, setConfirmRun] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState('');
  const [steps, setSteps] = useState<{ step: string; ok?: boolean; done: number; total: number }[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ dry: boolean; done: BatchItem[]; failed: BatchItem[]; stopped: string | null } | null>(null);
  const [dock, setDock] = useState<DockSize>('small');
  const [hidden, setHidden] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  const itemsRef = useRef(items); itemsRef.current = items;
  const analysingIds = useRef(new Set<string>());
  const pausedRef = useRef(false);
  const stopRef = useRef(false);
  const currentId = useRef<string | null>(null);
  const waiter = useRef<((o: Outcome) => void) | null>(null);
  const probeWaiter = useRef<((p: any) => void) | null>(null);
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
      analysePhotos(it.images, { notes: it.notes, hints: it.hints })
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
        if (d.type === 'diag:probe') { probeWaiter.current?.(d); return; }
        if (typeof d.type !== 'string' || !d.type.startsWith('vinted:')) return;
        if (d.itemId != null && String(d.itemId) !== currentId.current) return;
        if (d.type === 'vinted:progress') setSteps((p) => [...p, { step: String(d.step), ok: d.ok, done: Number(d.done) || 0, total: Number(d.total) || 0 }]);
        if (d.type === 'vinted:saveResult') waiter.current?.(d.ok && d.draftId ? { kind: 'saved', draftId: d.draftId } : { kind: 'notSaved', reason: `Vinted refused the save (status ${d.status})` });
        if (d.type === 'vinted:fatal') waiter.current?.({ kind: 'fatal', reason: String(d.error ?? d.message ?? 'Form filling failed') });
        if (d.type === 'vinted:report') {
          const errs = Array.isArray(d.errors) ? d.errors : [];
          if ((window as any).__batchDry) waiter.current?.(errs.length ? { kind: 'fatal', reason: `Field problems: ${errs.map((e: any) => typeof e === 'string' ? e : (e?.field ?? e?.message ?? JSON.stringify(e))).join(', ')}` } : { kind: 'dryOk' });
          else if (d.willSave === false || errs.length) waiter.current?.({ kind: 'fatal', reason: errs.length ? `Field problems: ${errs.map((e: any) => typeof e === 'string' ? e : (e?.field ?? e?.message ?? JSON.stringify(e))).join(', ')}` : 'Vinted form was not ready to save' });
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
  const acceptPrices = () => {
    const next = acceptAllPrices(itemsRef.current);
    next.forEach((n, i) => n !== itemsRef.current[i] && save(n));
    toast('Suggested prices accepted');
  };
  const clearFinished = async () => {
    for (const it of itemsRef.current.filter((i) => i.status === 'drafted')) await deleteItem(it.id);
    setItems((p) => p.filter((i) => i.status !== 'drafted'));
  };

  const probe = async () => {
    const p = new Promise<any>((res) => { probeWaiter.current = res; setTimeout(() => res(null), 8000); });
    await exec(PROBE_SCRIPT).catch(() => {});
    const r = await p; probeWaiter.current = null; return r;
  };

  const runBatch = async () => {
    setConfirmRun(false);
    const queue = runnable(itemsRef.current);
    if (!queue.length) return;
    const dry = dryRun;
    (window as any).__batchDry = dry;
    stopRef.current = false; pausedRef.current = false; setPaused(false);
    setRunning(true); setStopReason(null); setSummary(null);
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
        await goToNew(); await sleep(4000);
        const block = blockerFor(await probe());
        if (block) { stopped = block; break; }

        currentId.current = it.id;
        if (!dry) patch(it.id, { status: 'running' });
        const outcome = new Promise<Outcome>((res) => {
          waiter.current = res;
          setTimeout(() => res({ kind: 'timeout' }), SAVE_TIMEOUT_MS);
        });
        try { await injectAndRun(toDraft(it) as any, !dry, () => {}); }
        catch (e: any) { waiter.current?.({ kind: 'fatal', reason: e?.message || String(e) }); }
        const o = await outcome; waiter.current = null; currentId.current = null;
        const cur = itemsRef.current.find((x) => x.id === it.id)!;
        if (o.kind === 'saved') { const s = { ...cur, status: 'drafted' as const, draftId: o.draftId, draftedAt: Date.now(), error: undefined }; save(s); done.push(s); }
        else if (o.kind === 'dryOk') { const s = { ...cur, dryRun: 'ok' as const, error: undefined }; save(s); done.push(s); }
        else if (o.kind === 'timeout') {
          const s = { ...cur, status: dry ? cur.status : 'unknown' as const, dryRun: dry ? 'failed' as const : cur.dryRun, error: 'No answer from Vinted within 2 minutes. Check your Vinted drafts before retrying.' };
          save(s); failed.push(s); stopped = 'No answer from Vinted – result unknown'; break;
        } else {
          const s = { ...cur, status: dry ? cur.status : 'failed' as const, dryRun: dry ? 'failed' as const : cur.dryRun, error: o.reason };
          save(s); failed.push(s);
        }
        if (n < queue.length - 1 && !stopRef.current) {
          for (let t = PAUSE_BETWEEN_MS / 1000; t > 0 && !stopRef.current; t--) { setCountdown(t); setStatus(`Waiting before the next item…`); await sleep(1000); }
          setCountdown(0);
        }
      }
    } catch (e: any) { stopped = `Something went wrong: ${e?.message || e}`; }
    setRunning(false); setStatus(''); setCountdown(0); setStopReason(stopped);
    setSummary({ dry, done, failed, stopped });
  };

  const setSize = async (s: DockSize) => { setDock(s); await resizeVinted(s).catch(() => {}); };
  const toggleHidden = async () => { await (hidden ? showVinted() : hideVinted()).catch(() => {}); setHidden(!hidden); };

  const review = items.find((i) => i.id === reviewId) ?? null;
  const approved = runnable(items).length;
  const unconfirmed = items.filter((i) => i.status === 'needs_review' && !i.priceConfirmed && i.analysis?.suggestedPrice != null).length;
  const analysing = items.filter((i) => i.status === 'queued' || i.status === 'analysing').length;
  const last = steps[steps.length - 1];
  const pct = last?.total ? Math.round((last.done / last.total) * 100) : 0;

  return (
    <div className="container mx-auto max-w-2xl px-3 py-4 space-y-3" style={browserOpen && !hidden ? { paddingBottom: `${dock === 'large' ? 62 : 45}vh` } : undefined}>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11"><Link to="/profile" aria-label="Back"><ArrowLeft /></Link></Button>
        <h1 className="text-xl font-bold flex-1">Vinted drafts</h1>
        <span className="text-sm text-muted-foreground">{items.length}/{MAX_ITEMS}</span>
      </div>

      {!native && <Card><CardContent className="p-3 text-sm text-muted-foreground">You can add and review items here, but sending to Vinted only works in the Family Hub Android app.</CardContent></Card>}

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
            {!summary.dry && summary.done.map((d) => (
              <a key={d.id} href={draftLink(d.draftId!)} target="_blank" rel="noreferrer" className="block text-primary underline truncate">{d.title}</a>
            ))}
            {summary.failed.map((f) => <div key={f.id} className="text-destructive">{f.title}: {f.error}</div>)}
            {stopReason && /logged out|bot check|open its app/.test(stopReason) && <p className="text-muted-foreground">Sort this out in the Vinted panel below, then tap Run batch again.</p>}
            <Button variant="ghost" className="h-11" onClick={() => setSummary(null)}>Close</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button className="h-11" onClick={() => setAdding(true)} disabled={!canAdd(items) || running}><Plus className="mr-1 h-4 w-4" />Add item</Button>
        <Button className="h-11" variant="secondary" disabled={!approved || running || !native} onClick={() => setConfirmRun(true)}><Play className="mr-1 h-4 w-4" />Run batch ({approved})</Button>
      </div>
      {unconfirmed > 0 && <Button variant="outline" className="h-11 w-full" onClick={acceptPrices}>Accept all suggested prices ({unconfirmed})</Button>}
      {analysing > 0 && <p className="text-xs text-muted-foreground">AI is analysing {analysing} item{analysing > 1 ? 's' : ''} (two at a time). Keep this screen open.</p>}

      {loaded && !items.length && <Card><CardContent className="p-4 text-sm text-muted-foreground">No items yet. Tap Add item, pick up to 5 photos and add any notes about flaws.</CardContent></Card>}

      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id}>
            <button className="w-full text-left" onClick={() => setReviewId(it.id)} disabled={running}>
              <Card><CardContent className="p-2 flex gap-3 items-center min-w-0">
                <img src={`data:image/jpeg;base64,${it.images[0]?.base64}`} alt="" className="h-14 w-14 rounded object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{it.title || it.notes || 'New item'}</div>
                  <div className="text-xs text-muted-foreground">{it.price ? `£${it.price}${it.priceConfirmed ? '' : ' (not confirmed)'}` : '–'}{it.dryRun ? ` · dry run ${it.dryRun === 'ok' ? 'OK' : 'failed'}` : ''}</div>
                  {it.error && <div className="text-xs text-destructive truncate">{it.error}</div>}
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
          {review && <ReviewForm it={review} onChange={save} onDelete={() => remove(review.id)} onClose={() => setReviewId(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRun} onOpenChange={setConfirmRun}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run {approved} item{approved > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              {dryRun ? 'Dry run: the Vinted form is filled in but nothing is saved.' : 'This saves real drafts in your Vinted account. Nothing is published, and nothing is ever deleted automatically.'} There is a 30 second pause between items. Keep this screen open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-2"><Switch id="dry" checked={dryRun} onCheckedChange={setDryRun} /><Label htmlFor="dry">Dry run (don't save)</Label></div>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={runBatch}>{dryRun ? 'Start dry run' : 'Save drafts'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReviewForm({ it, onChange, onDelete, onClose }: { it: BatchItem; onChange: (i: BatchItem) => void; onDelete: () => void; onClose: () => void }) {
  const a = it.analysis;
  const set = (o: Partial<BatchItem>) => onChange({ ...it, ...o, status: it.status === 'approved' ? 'needs_review' : it.status });
  const errors = approvalErrors(it);
  const conds = a?.categoryLeafId != null ? allowedConditions(a.categoryLeafId) : {};
  const done = it.status === 'drafted';
  return (
    <div className="space-y-3 text-sm">
      <DialogHeader><DialogTitle>{STATUS[it.status]}</DialogTitle></DialogHeader>
      <div className="flex gap-2 overflow-x-auto">{it.images.map((im, i) => <img key={i} src={`data:image/jpeg;base64,${im.base64}`} alt="" className="h-20 w-20 rounded object-cover shrink-0" />)}</div>
      {it.error && <p className="text-destructive">{it.error}</p>}
      {done && it.draftId && <a className="text-primary underline" href={draftLink(it.draftId)} target="_blank" rel="noreferrer">Open draft on Vinted</a>}
      {it.status === 'unknown' && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={() => onChange({ ...it, status: 'drafted', error: undefined })}>It's in my drafts</Button>
          <Button variant="outline" className="h-11" onClick={() => onChange({ ...it, status: 'approved', error: undefined })}>Not there – retry</Button>
        </div>
      )}
      {it.status === 'failed' && <Button variant="outline" className="h-11 w-full" onClick={() => onChange({ ...it, status: 'approved', error: undefined })}>Try again in next batch</Button>}
      {(it.status === 'analysis_failed' || (a && !done)) && <Button variant="outline" className="h-11 w-full" onClick={() => onChange({ ...it, status: 'queued', error: undefined })}>Analyse again</Button>}

      {a && !done && (
        <>
          {a.flags.filter((f) => f !== 'confirm_condition').length > 0 && <div className="flex flex-wrap gap-1">{a.flags.filter((f) => f !== 'confirm_condition').map((f) => <Badge key={f} variant="outline">{f.replace(/_/g, ' ')}</Badge>)}</div>}
          <Label>Title</Label>
          <Input value={it.title} onChange={(e) => set({ title: e.target.value })} />
          <Label>Description</Label>
          <Textarea rows={5} value={it.description} onChange={(e) => set({ description: e.target.value })} />
          <Label>Condition</Label>
          <select className="h-11 w-full rounded-md border border-input bg-background px-2" value={it.conditionId ?? ''} onChange={(e) => set({ conditionId: Number(e.target.value) })}>
            {Object.entries(conds).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">{a.conditionReason}</p>
          <Label>Price (£)</Label>
          <div className="flex gap-2">
            <Input inputMode="decimal" value={it.price} onChange={(e) => set({ price: e.target.value, priceConfirmed: false })} />
            <Button className="h-11 shrink-0" variant={it.priceConfirmed ? 'secondary' : 'default'} onClick={() => set({ priceConfirmed: true })} disabled={it.priceConfirmed}>{it.priceConfirmed ? 'Confirmed' : 'Confirm'}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Suggested £{a.suggestedPrice ?? '–'} ({a.priceConfidence} confidence). {a.priceRationale}</p>
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
