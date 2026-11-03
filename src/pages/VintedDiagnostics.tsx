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
import { closeVinted, exec, goToNew, injectAndRun, listen, openVinted, pluginVersion, PROBE_SCRIPT, VINTED_SCRIPT } from '@/vinted/browser';

type Probe = { url: string; userAgent: string; width: number; hasTitleField: boolean; botCheck: boolean; loginWall: boolean; openInApp: boolean };
type LogLine = { at: string; text: string };

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
  const runId = useRef<string | null>(null);

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
          if (d.type === 'vinted:report') setReport(d);
          if (d.type === 'vinted:report' || d.type === 'vinted:fatal' || d.type === 'vinted:saveResult') setRunning(false);
        } else {
          add(`message ${JSON.stringify(d)}`);
        }
      },
      onUrl: (u) => { setUrl(u); add(`URL ${u}`); },
      onLoaded: () => { add('Page loaded'); setTimeout(() => exec(PROBE_SCRIPT).catch(() => {}), 1500); },
      onConsole: (level, msg) => { if (msg.includes('[vinted-draft]')) add(`console.${level}: ${msg.slice(0, 500)}`); },
      onClose: () => { setOpen(false); add('Browser closed'); },
    }).then((o) => (off = o));
    return () => off?.();
  }, [native]);

  const doOpen = async () => {
    try { await openVinted(); setOpen(true); add('Opened Vinted'); }
    catch (e: any) { add(`Open failed: ${e?.message || e}`); }
  };

  const runTest = async () => {
    if (!files.length) { toast({ title: 'Pick up to 5 photos first' }); return; }
    setRunning(true); setReport(null);
    const id = `diag-${Date.now()}`;
    runId.current = id;
    try {
      const t = performance.now();
      const images = await Promise.all(files.slice(0, 5).map(resizeForVinted));
      add(`Resized ${images.length} photos in ${Math.round(performance.now() - t)} ms: ${images.map((i) => `${(i.base64.length / 1024).toFixed(0)} KB`).join(', ')}`);
      const item = buildTestItem(id, images);
      add(`Test item: leaf ${item.categoryLeafId}, path [${item.categoryPath}], size ${item.sizeId}, brand ${item.brandName}`);
      const stats = await injectAndRun(item, false, add);
      add(`Payload: ${JSON.stringify(stats)}`);
    } catch (e: any) {
      add(`Run failed: ${e?.message || e}`);
      setRunning(false);
    }
  };

  const copyLog = async () => {
    const text = [
      `Plugin ${version} · Script ${SCRIPT_LINES} lines · Reference ${REFERENCE_CAPTURED}`,
      `Probe: ${JSON.stringify(probe)}`,
      ...log.map((l) => `${l.at} ${l.text}`),
    ].join('\n');
    await navigator.clipboard.writeText(text);
    toast({ title: 'Log copied' });
  };

  const yn = (v?: boolean) => (v === undefined ? '–' : v ? 'Yes' : 'No');
  const blockers = probe ? [
    probe.botCheck && 'Bot check / captcha',
    probe.loginWall && 'Login wall',
    probe.openInApp && '"Open in the app" screen',
    probe.width < 900 && 'Mobile layout (narrow page)',
  ].filter(Boolean) as string[] : [];

  return (
    <div className="container mx-auto max-w-2xl px-3 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11"><Link to="/profile" aria-label="Back"><ArrowLeft /></Link></Button>
        <h1 className="text-xl font-bold">Vinted browser diagnostics</h1>
      </div>

      {!native ? (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Android app only. Open this screen in the Family Hub app on your phone.</CardContent></Card>
      ) : (
        <>
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
              <Button className="h-11 w-full" disabled={!open || running} onClick={runTest}><Play className="mr-1 h-4 w-4" />{running ? 'Running…' : 'Run test'}</Button>
            </CardContent>
          </Card>

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
