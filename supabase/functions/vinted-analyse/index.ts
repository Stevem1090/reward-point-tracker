import { geminiJson, geminiErrorResponse } from "../_shared/gemini.ts";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) throw new Error("Supabase is not configured");
    const sb = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
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

    const result = await geminiJson({
      system: `${rules}\n\nREFERENCE:\n${reference}`,
      user: [
        { text: `These ${images.length} photos show ONE item. Analyse them and return the listing as JSON.\n\nSELLER NOTES: ${sellerNotes || "(none)"}\nSELLER HINTS: ${sellerHints || "(none)"}\n${writingContext}\nRecent batch openers (vary yours): ${openers || "(none yet)"}` },
        ...images.flatMap((b64: string, i: number) => [{ text: `Photo ${i + 1}` }, { image: b64 }]),
      ],
      schema,
    });
    return json({ result });
  } catch (e) {
    console.error(e);
    return geminiErrorResponse(e, cors);
  }
});
