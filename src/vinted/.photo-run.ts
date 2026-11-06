// @ts-nocheck
import { readFileSync, writeFileSync } from 'fs';
import { analysisSchema, ANALYSIS_RULES, normaliseAnalysis } from './analysis';
import { arrangeFromPlan } from './photos';
import ref from './vinted-reference-kids-for-ai.txt' with { type: 'text' };
const items = JSON.parse(readFileSync('/tmp/photo-test/items.json', 'utf8'));
const key = process.env.LOVABLE_API_KEY;
const results = await Promise.all(items.map(async (it) => {
  const imgs = it.files.map((f) => readFileSync('/tmp/photo-test/' + f).toString('base64'));
  const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai/gpt-6-astra', store: false, reasoning: { effort: 'low' }, instructions: `${ANALYSIS_RULES}\n\nREFERENCE:\n${ref}`,
      input: [{ role: 'user', content: [{ type: 'input_text', text: `These ${imgs.length} photos show ONE item. Analyse them and return the listing as JSON.\n\nSELLER NOTES: ${it.notes || '(none)'}\nSELLER HINTS: (none)\nRecent batch openers (vary yours): (none yet)` },
        ...imgs.flatMap((b, i) => [{ type: 'input_text', text: `Photo ${i + 1}` }, { type: 'input_image', image_url: `data:image/jpeg;base64,${b}` }])] }],
      text: { format: { type: 'json_schema', name: 'listing', schema: analysisSchema(), strict: true } } }) });
  const j = await res.json();
  const txt = j.output?.flatMap((o) => o.content ?? []).find((c) => c.type === 'output_text')?.text;
  if (!txt) return { ...it, error: JSON.stringify(j).slice(0, 300) };
  const raw = JSON.parse(txt); const a = normaliseAnalysis(raw, imgs.length);
  return { ...it, title: a.title, rawPhotos: raw.photos, flags: a.flags, arranged: arrangeFromPlan(a.photos, imgs.map((_, i) => i)) };
}));
writeFileSync('/tmp/photo-test/results.json', JSON.stringify(results, null, 1));
console.log(JSON.stringify(results.map((r) => ({ n: r.name, e: r.error, a: r.arranged, raw: r.rawPhotos, f: r.flags })), null, 0));
