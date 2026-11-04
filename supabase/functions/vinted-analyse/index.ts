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

    const { images, schema, rules, reference } = await req.json();
    if (!Array.isArray(images) || images.length === 0 || images.length > 10) return json({ error: "Send 1-10 photos" }, 400);
    if (!schema || typeof rules !== "string" || typeof reference !== "string") return json({ error: "Bad request" }, 400);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: `${rules}\n\nREFERENCE:\n${reference}` },
          {
            role: "user",
            content: [
              { type: "text", text: `These ${images.length} photos show ONE item. Analyse them and return the listing.` },
              ...images.map((b64: string) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } })),
            ],
          },
        ],
        tools: [{ type: "function", function: { name: "return_listing", description: "Return the structured listing", parameters: schema } }],
        tool_choice: { type: "function", function: { name: "return_listing" } },
      }),
    });
    if (res.status === 429) return json({ error: "AI is busy, try again in a minute" }, 429);
    if (res.status === 402) return json({ error: "AI credits have run out" }, 402);
    if (!res.ok) { console.error("gateway", res.status, await res.text()); return json({ error: `AI request failed (${res.status})` }, 500); }
    const data = await res.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: "AI returned no listing" }, 500);
    return json({ result: JSON.parse(args) });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
