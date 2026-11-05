import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Globe, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { isNativeApp } from '@/lib/native/platform';
import { toast } from '@/lib/toast';
import { REFERENCE_CAPTURED } from '@/vinted/reference';
import { resizeForVinted } from '@/vinted/imageResize';
import { buildTestItem } from '@/vinted/testItem';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { analysePhotos, analysisToDraft, type Analysis } from '@/vinted/analysis';
import { allowedConditions, validateForApproval } from '@/vinted/validate';
import { Textarea } from '@/components/ui/textarea';
import { closeVinted, exec, goToNew, hideVinted, resizeVinted, showVinted, type DockSize, injectAndRun, listen, openVinted, pluginVersion, PROBE_SCRIPT, VINTED_SCRIPT } from '@/vinted/browser';

type Probe = { url: string; userAgent: string; width: number; hasTitleField: boolean; botCheck: boolean; loginWall: boolean; openInApp: boolean };
type LogLine = { at: string; text: string };
type Step = { step: string; ok?: boolean; done: number; total: number };

const SCRIPT_LINES = VINTED_SCRIPT.split('\n').length;

export default function VintedDiagnostics() {
  const native = isNativeApp();
  const [version, setVersion] = useState('…');
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [probe, setProbe] = useState<Probe | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [report, setReport] = useState<any>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [dock, setDock] = useState<DockSize>('small');
  const [hidden, setHidden] = useState(false);
  const runId = useRef<string | null>(null);
  const [confirmLive, setConfirmLive] = useState(false);
  const [save, setSave] = useState<{ ok: boolean; status: number; draftId: any; sentPrice: any; alerts?: any[]; at: number; receivedAt: number } | null>(null);
  const saveRef = useRef<number | null>(null);
  const liveMode = useRef(false);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [redirectAt, setRedirectAt] = useState<{ url: string; at: number } | null>(null);
  const [liveUnknown, setLiveUnknown] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [aiPrice, setAiPrice] = useState('');
  const [aiImagesCount, setAiImagesCount] = useState(0);
  const [notes, setNotes] = useState('');
  const [hints, setHints] = useState('');
  const [analysedNotes, setAnalysedNotes] = useState('');
  const [condition, setCondition] = useState<number | null>(null);
  const [edited, setEdited] = useState({ condition: false });

  const add = (text: string) => setLog((l) => [...l, { at: new Date().toLocaleTimeString('en-GB'), text }]);

  useEffect(() => {
    if (!native) return;
    pluginVersion().then(setVersion);
    let off: (() => void) | undefined;
    listen({
      onMessage: (d) => {
        if (d.type === 'diag:probe') { setProbe(d as Probe); return; }
        if (typeof d.type === 'string' && d.type.startsWith('vinted:')) {
          // fatal may arrive with itemId null; only one run at a time, so it belongs to this run
          if (d.itemId != null && runId.current && String(d.itemId) !== runId.current) {
            add(`Ignored ${d.type} for another item (${d.itemId})`);
            return;
          }
          add(`${d.type} ${JSON.stringify(d)}`);
          if (d.type === 'vinted:progress') setSteps((p) => [...p, { step: String(d.step), ok: d.ok, done: Number(d.done) || 0, total: Number(d.total) || 0 }]);
          if (d.type === 'vinted:report') setReport(d);
          if (d.type === 'vinted:saveResult') {
            const receivedAt = Date.now();
            saveRef.current = receivedAt;
            setSave({ ok: !!d.ok, status: Number(d.status), draftId: d.draftId, sentPrice: d.sentPrice, alerts: d.alerts, at: Number(d.at) || receivedAt, receivedAt });
          }
          if ((d.type === 'vinted:saveResult' || d.type === 'vinted:fatal') && liveTimer.current) { clearTimeout(liveTimer.current); liveTimer.current = null; }
          if ((d.type === 'vinted:report' && !liveMode.current) || d.type === 'vinted:fatal' || d.type === 'vinted:saveResult') setRunning(false);
        } else {
          add(`message ${JSON.stringify(d)}`);
        }
      },
      onUrl: (u) => {
        setUrl(u); add(`URL ${u}`);
        if (liveMode.current && !/\/items\/new/.test(u)) setRedirectAt((p) => p ?? { url: u, at: Date.now() });
      },
      onLoaded: () => { add('Page loaded'); setTimeout(() => exec(PROBE_SCRIPT).catch(() => {}), 1500); },
      onConsole: (level, msg) => { if (msg.includes('[vinted-draft]')) add(`console.${level}: ${msg.slice(0, 500)}`); },
      onClose: () => { setOpen(false); add('Browser closed'); },
    }).then((o) => (off = o));
    return () => off?.();
  }, [native]);

  const doOpen = async () => {
    try { await openVinted(dock); setOpen(true); setHidden(false); add('Opened Vinted (docked below)'); }
    catch (e: any) { add(`Open failed: ${e?.message || e}`); }
  };

  const runTest = async (live = false) => {
    if (!files.length) { toast('Pick up to 5 photos first'); return; }
    setRunning(true); setReport(null); setSteps([]); setSave(null); setRedirectAt(null); setLiveUnknown(false);
    saveRef.current = null;
    liveMode.current = live;
    const id = `diag-${live ? 'live' : 'dry'}-${Date.now()}`;
    runId.current = id;
    try {
      if (!open) {
        add('Opening Vinted browser for test…');
        await openVinted(dock); setOpen(true); setHidden(false);
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        await goToNew(); add('Fresh /items/new');
        await new Promise((r) => setTimeout(r, 4000));
      }
      const t = performance.now();
      const images = await Promise.all(files.slice(0, 5).map((f, i) => resizeForVinted(f, i)));
      add(`Resized ${images.length} photos in ${Math.round(performance.now() - t)} ms: ${images.map((i) => `${(i.base64.length / 1024).toFixed(0)} KB`).join(', ')}`);
      const item = buildTestItem(id, images);
      if (live) { item.title = 'Test draft please delete'; item.description = 'Test draft created by Family Hub diagnostics. Please delete.'; }
      add(`Test item: leaf ${item.categoryLeafId}, path [${item.categoryPath}], size ${item.sizeId}, brand ${item.brandName}`);
      liveMode.current = live; // ignore URL changes from the fresh-form navigation above
      setRedirectAt(null);
      const stats = await injectAndRun(item, live, add);
      if (live) {
        liveTimer.current = setTimeout(() => { setLiveUnknown(true); setRunning(false); add('No saveResult or fatal within 120 s: result unknown. Check your Vinted drafts by hand before retrying.'); }, 120_000);
      }
      add(`Payload: ${JSON.stringify(stats)}`);
    } catch (e: any) {
      add(`Run failed: ${e?.message || e}`);
      setRunning(false);
    }
  };

  /** overwrite=false keeps fields the user edited by hand (condition, price). */
  const runAnalysis = async (overwrite = true) => {
    if (!files.length) { toast('Pick photos first'); return; }
    setAiBusy(true);
    try {
      const images = await Promise.all(files.slice(0, 5).map((f, i) => resizeForVinted(f, i)));
      setAiImagesCount(images.length);
      const t = performance.now();
      const a = await analysePhotos(images, { notes, hints });
      add(`AI analysis in ${Math.round(performance.now() - t)} ms: ${JSON.stringify(a)}`);
      setAnalysis(a);
      setAnalysedNotes(notes);
      if (overwrite || !edited.condition) { setCondition(a.conditionId); setEdited((e) => ({ ...e, condition: false })); }
      if (overwrite) setAiPrice('');
    } catch (e: any) { add(`AI analysis failed: ${e?.message || e}`); toast(`Analysis failed: ${e?.message || e}`); }
    finally { setAiBusy(false); }
  };
  const aiDraft = analysis
    ? { ...analysisToDraft(analysis, 'preview', Array.from({ length: aiImagesCount }, (_, i) => ({ name: `p${i}.jpg`, type: 'image/jpeg', base64: 'x' })), aiPrice ? Number(aiPrice) : null), conditionId: condition ?? undefined }
    : null;
  const aiErrors = aiDraft ? validateForApproval(aiDraft, { flags: analysis!.flags }) : [];
  const condOptions = analysis?.categoryLeafId != null ? allowedConditions(analysis.categoryLeafId) : {};

  const copyLog = async () => {
    const text = [
      `Plugin ${version} · Script ${SCRIPT_LINES} lines · Reference ${REFERENCE_CAPTURED}`,
      `Probe: ${JSON.stringify(probe)}`,
      ...log.map((l) => `${l.at} ${l.text}`),
    ].join('\n');
    await navigator.clipboard.writeText(text);
    toast('Log copied');
  };

  const setSize = async (s: DockSize) => { setDock(s); try { await resizeVinted(s); } catch (e: any) { add(`Resize failed: ${e?.message || e}`); } };
  const toggleHidden = async () => {
    try { hidden ? await showVinted() : await hideVinted(); setHidden(!hidden); }
    catch (e: any) { add(`${hidden ? 'Show' : 'Hide'} failed: ${e?.message || e}`); }
  };
  const last = steps[steps.length - 1];
  const pct = last && last.total ? Math.round((last.done / last.total) * 100) : 0;

  const yn = (v?: boolean) => (v === undefined ? '–' : v ? 'Yes' : 'No');
  const blockers = probe ? [
    probe.botCheck && 'Bot check / captcha',
    probe.loginWall && 'Login wall',
    probe.openInApp && '"Open in the app" screen',
    probe.width < 360 && 'Page narrower than 360px',
  ].filter(Boolean) as string[] : [];

  return (
    <div className="container mx-auto max-w-2xl px-3 py-4 space-y-3" style={open && !hidden ? { paddingBottom: `${Math.round((dock === 'large' ? 0.62 : 0.45) * 100)}vh` } : undefined}>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11"><Link to="/profile" aria-label="Back"><ArrowLeft /></Link></Button>
        <h1 className="text-xl font-bold">Vinted browser diagnostics</h1>
      </div>

      {!native ? (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Android app only. Open this screen in the Family Hub app on your phone.</CardContent></Card>
      ) : (
        <>
          {(running || steps.length > 0) && (
            <Card className="sticky top-0 z-10">
              <CardContent className="p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{running ? `Filling form… ${last?.step ?? 'starting'}` : report ? 'Finished' : 'Stopped'}</span>
                  <span className="text-muted-foreground">{last ? `${last.done}/${last.total}` : ''}</span>
                </div>
                <Progress value={pct} />
                <ul className="max-h-28 overflow-y-auto text-xs space-y-0.5">
                  {steps.map((s, i) => (
                    <li key={i} className={s.ok === false ? 'text-destructive' : ''}>{s.ok === false ? '✕' : '✓'} {s.step}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {open && (
            <div className="grid grid-cols-3 gap-2">
              <Button className="h-11" variant={dock === 'small' && !hidden ? 'default' : 'outline'} onClick={() => setSize('small')}>Small</Button>
              <Button className="h-11" variant={dock === 'large' && !hidden ? 'default' : 'outline'} onClick={() => setSize('large')}>Large</Button>
              <Button className="h-11" variant="outline" onClick={toggleHidden}>{hidden ? 'Show' : 'Hide'}</Button>
            </div>
          )}

          <Card>
            <CardHeader className="p-3 pb-1"><CardTitle className="text-base">Status</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0 text-sm space-y-1 break-all">
              <div><span className="text-muted-foreground">URL:</span> {url || probe?.url || '–'}</div>
              <div><span className="text-muted-foreground">Logged in:</span> {yn(probe?.hasTitleField)}</div>
              <div><span className="text-muted-foreground">Page width:</span> {probe ? `${probe.width}px` : '–'}</div>
              <div><span className="text-muted-foreground">User agent:</span> {probe?.userAgent || '–'}</div>
              <div><span className="text-muted-foreground">Plugin:</span> {version} · <span className="text-muted-foreground">Script:</span> {SCRIPT_LINES} lines · <span className="text-muted-foreground">Reference:</span> {REFERENCE_CAPTURED}</div>
              {probe && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {blockers.length ? blockers.map((b) => <Badge key={b} variant="destructive">{b}</Badge>) : <Badge variant="secondary">No blockers seen</Badge>}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <Button className="h-11" onClick={doOpen}><Globe className="mr-1 h-4 w-4" />{open ? 'Reopen Vinted' : 'Open Vinted'}</Button>
            <Button className="h-11" variant="outline" disabled={!open} onClick={() => { goToNew(); add('Back to /items/new'); }}><RotateCcw className="mr-1 h-4 w-4" />Fresh form</Button>
            <Button className="h-11" variant="outline" disabled={!open} onClick={() => exec(PROBE_SCRIPT)}>Check page</Button>
            <Button className="h-11" variant="outline" disabled={!open} onClick={() => { closeVinted(); setOpen(false); }}>Close browser</Button>
          </div>

          <Card>
            <CardHeader className="p-3 pb-1"><CardTitle className="text-base">Dry run test</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0 space-y-2 text-sm">
              <input type="file" accept="image/*" multiple className="block w-full text-sm" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} />
              <p className="text-muted-foreground">{files.length} photo(s) chosen. Nothing is saved to Vinted (saveDraft: false).</p>
              <Button className="h-11 w-full" disabled={files.length === 0 || running} onClick={() => runTest(false)}><Play className="mr-1 h-4 w-4" />{running ? 'Running…' : 'Run test'}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-1"><CardTitle className="text-base">Live test (creates a real draft)</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0 space-y-2 text-sm">
              <p className="text-muted-foreground">Uses the photos above and the title "Test draft please delete". Saves one draft to your Vinted account.</p>
              <Button className="h-11 w-full" variant="destructive" disabled={files.length === 0 || running} onClick={() => setConfirmLive(true)}>Run live test</Button>
              {(save || liveUnknown) && (
                <div className="space-y-1 rounded border p-2">
                  {save ? (<>
                    <div><span className="text-muted-foreground">ok:</span> <b className={save.ok ? '' : 'text-destructive'}>{String(save.ok)}</b> · <span className="text-muted-foreground">status:</span> {save.status}</div>
                    <div><span className="text-muted-foreground">draftId:</span> {save.draftId ?? '–'} · <span className="text-muted-foreground">sentPrice:</span> {save.sentPrice ?? '–'}</div>
                    {save.alerts?.length ? <div className="text-destructive">Alerts: {save.alerts.join('; ')}</div> : null}
                    {save.draftId && <a className="text-primary underline break-all" href={`https://www.vinted.co.uk/items/${save.draftId}/edit`} target="_blank" rel="noreferrer">https://www.vinted.co.uk/items/{save.draftId}/edit</a>}
                    <div className="text-xs">
                      Result event: {new Date(save.receivedAt).toLocaleTimeString('en-GB')}.{String(save.receivedAt % 1000).padStart(3, '0')}
                      {redirectAt ? <> · Page changed: {new Date(redirectAt.at).toLocaleTimeString('en-GB')}.{String(redirectAt.at % 1000).padStart(3, '0')} → <b>{save.receivedAt <= redirectAt.at ? `result arrived first (${redirectAt.at - save.receivedAt} ms earlier)` : `page changed first (${save.receivedAt - redirectAt.at} ms earlier)`}</b></> : ' · No page change seen yet'}
                    </div>
                  </>) : <div className="text-destructive">Unknown: no result within 120 seconds. Check your Vinted drafts before trying again.</div>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-1"><CardTitle className="text-base">AI analysis test</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0 space-y-2 text-sm">
              <p className="text-muted-foreground">Reads the photos above and your notes, and suggests a listing. Nothing is sent to Vinted.</p>
              <Textarea placeholder='Notes (optional), e.g. "slight mark on the front", "worn twice"' value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              <Input className="h-11" placeholder='Hints (optional), e.g. "girls", "age 2"' value={hints} onChange={(e) => setHints(e.target.value)} />
              <Button className="h-11 w-full" variant="outline" disabled={files.length === 0 || aiBusy} onClick={() => runAnalysis(true)}>{aiBusy ? 'Analysing…' : 'Analyse photos'}</Button>
              {analysis && notes !== analysedNotes && (
                <div className="rounded border p-2 space-y-2">
                  <p>Notes changed since the analysis.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button className="h-11" variant="outline" disabled={aiBusy} onClick={() => runAnalysis(false)}>Re-run, keep my edits</Button>
                    <Button className="h-11" variant="outline" disabled={aiBusy} onClick={() => runAnalysis(true)}>Re-run, overwrite all</Button>
                  </div>
                </div>
              )}
              {analysis && (
                <div className="space-y-2">
                  <div className="font-medium">{analysis.title}</div>
                  <div className="whitespace-pre-line rounded bg-muted p-2">{analysis.description}</div>
                  {analysis.notesUsed.length > 0 && <div className="text-xs text-muted-foreground">Notes used: {analysis.notesUsed.join('; ')}</div>}

                  <label className="block text-xs text-muted-foreground">Condition</label>
                  <select className="h-11 w-full rounded-md border border-input bg-background px-2" value={condition ?? ''} onChange={(e) => { setCondition(Number(e.target.value)); setEdited((x) => ({ ...x, condition: true })); }}>
                    {Object.entries(condOptions).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                  </select>
                  {analysis.conditionReason && <p className="text-xs text-muted-foreground">{analysis.conditionReason}</p>}

                  <label className="block text-xs text-muted-foreground">Price £</label>
                  <Input className="h-11" inputMode="decimal" placeholder="Leave empty" value={aiPrice} onChange={(e) => setAiPrice(e.target.value)} />
                  <p className="text-xs text-muted-foreground">{aiPrice ? 'Your custom price will be used.' : 'Vinted Optimal + £0.50 (set when drafting)'}</p>

                  {analysis.flags.length > 0 && <div className="flex flex-wrap gap-1">{analysis.flags.map((f) => <Badge key={f} variant={f === 'cannot_list_underwear' ? 'destructive' : 'secondary'}>{f}</Badge>)}</div>}
                  <div className={aiErrors.length ? 'text-destructive' : ''}>{aiErrors.length ? `Blocked: ${aiErrors.join('; ')}` : 'Ready: passes all checks'}</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">{JSON.stringify(analysis, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>

          <AlertDialog open={confirmLive} onOpenChange={setConfirmLive}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Create a real Vinted draft?</AlertDialogTitle>
                <AlertDialogDescription>This saves a real draft called "Test draft please delete" in your Vinted account. It won't be published, and Family Hub won't delete it. You'll need to delete it yourself.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
                <AlertDialogAction className="h-11" onClick={() => runTest(true)}>Create draft</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {report && (
            <Card>
              <CardHeader className="p-3 pb-1"><CardTitle className="text-base">Final report</CardTitle></CardHeader>
              <CardContent className="p-3 pt-0 text-sm space-y-1">
                <div>Errors: {report.errors?.length ? report.errors.join('; ') : 'none'}</div>
                <div>Warnings: {report.warnings?.length ? report.warnings.join('; ') : 'none'}</div>
                <div>Would save: {String(report.willSave)}</div>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">{JSON.stringify(report.finalValues, null, 2)}</pre>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="p-3 pb-1 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Live log</CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setLog([])}>Clear</Button>
                <Button size="sm" variant="outline" onClick={copyLog}><Copy className="mr-1 h-3 w-3" />Copy</Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="max-h-96 overflow-y-auto text-xs font-mono space-y-1 break-all">
                {log.length ? log.map((l, i) => <div key={i}><span className="text-muted-foreground">{l.at}</span> {l.text}</div>) : <span className="text-muted-foreground">No events yet.</span>}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
