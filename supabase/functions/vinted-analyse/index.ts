import { GEMINI_CHAT_URL, requireGeminiResponse, geminiErrorResponse } from "../_shared/gemini.ts";
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

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY not configured");

    const res = await fetch(GEMINI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        stream: true,
        messages: [{ role: "system", content: `${rules}\n\nREFERENCE:\n${reference}` }, {
          role: "user",
          content: [
            { type: "text", text: `These ${images.length} photos show ONE item. Analyse them and return the listing as JSON.\n\nSELLER NOTES: ${sellerNotes || "(none)"}\nSELLER HINTS: ${sellerHints || "(none)"}\n${writingContext}\nRecent batch openers (vary yours): ${openers || "(none yet)"}` },
            ...images.flatMap((b64: string, i: number) => [{ type: "text", text: `Photo ${i + 1}` }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } }]),
          ],
        }],
        response_format: { type: "json_schema", json_schema: { name: "listing", schema, strict: true } },
      }),
    });
    await requireGeminiResponse(res);
    if (!res.body) throw new Error("Google returned no analysis stream");
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
          args += ev.choices?.[0]?.delta?.content ?? "";
          if (ev.type === "response.failed" || ev.type === "error") failed = JSON.stringify(ev).slice(0, 300);
        } catch { /* partial */ }
      }
    }
    if (failed) { console.error("ai failed", failed); return json({ error: "AI analysis failed" }, 500); }
    if (!args) return json({ error: "AI returned no listing" }, 500);
    return json({ result: JSON.parse(args) });
  } catch (e) {
    console.error(e);
    return geminiErrorResponse(e, cors);
  }
});
