import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing auth" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { images, schema, rules, reference, notes, hints, descriptionOnly, recentOpeners } = await req.json();
    const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n).trim() : "");
    const sellerNotes = clip(notes, 1000), sellerHints = clip(hints, 300);
    const writingContext = descriptionOnly && typeof descriptionOnly === 'object'
      ? `Regenerate ONLY the description for this existing listing. The chosen conditionId is ${Number(descriptionOnly.conditionId)}; match it, do not change it. Current title: ${clip(descriptionOnly.title, 200)}. Current description (vary wording, preserve supported facts): ${clip(descriptionOnly.description, 1500)}. Return the usual JSON; only description will be applied.` : '';
    const openers = Array.isArray(recentOpeners) ? recentOpeners.slice(-10).map((v) => clip(v, 100)).join(' | ') : '';
    if (!Array.isArray(images) || images.length === 0 || images.length > 10) return json({ error: "Send 1-10 photos" }, 400);
    if (!schema || typeof rules !== "string" || typeof reference !== "string") return json({ error: "Bad request" }, 400);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: `${rules}\n\nREFERENCE:\n${reference}`,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: `These ${images.length} photos show ONE item. Analyse them and return the listing as JSON.\n\nSELLER NOTES: ${sellerNotes || "(none)"}\nSELLER HINTS: ${sellerHints || "(none)"}\n${writingContext}\nRecent batch openers (vary yours): ${openers || "(none yet)"}` },
            ...images.map((b64: string) => ({ type: "input_image", image_url: `data:image/jpeg;base64,${b64}` })),
          ],
        }],
        text: { format: { type: "json_schema", name: "listing", schema, strict: true } },
      }),
    });
    if (res.status === 429) return json({ error: "AI is busy, try again in a minute" }, 429);
    if (res.status === 402) return json({ error: "AI credits have run out" }, 402);
    if (!res.ok || !res.body) { console.error("gateway", res.status, await res.text()); return json({ error: `AI request failed (${res.status})` }, 500); }
    let args = "", buf = "", failed = "";
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === "response.output_text.delta") args += ev.delta ?? "";
          if (ev.type === "response.failed" || ev.type === "error") failed = JSON.stringify(ev).slice(0, 300);
        } catch { /* partial */ }
      }
    }
    if (failed) { console.error("ai failed", failed); return json({ error: "AI analysis failed" }, 500); }
    if (!args) return json({ error: "AI returned no listing" }, 500);
    return json({ result: JSON.parse(args) });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
