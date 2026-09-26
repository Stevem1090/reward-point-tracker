import { Resend } from "npm:resend@1.0.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { getCaller, escapeHtml } from "../_shared/auth.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Structured summary only: the server builds the HTML, escaping every value.
const Body = z.object({
  date: z.string().max(40),
  totalPoints: z.number().int(),
  categories: z.array(z.object({
    name: z.string().max(200),
    points: z.number().int(),
    entries: z.array(z.object({ description: z.string().max(500), points: z.number().int() })).max(200),
  })).max(100),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const caller = await getCaller(req);
    if (!caller?.user.email) return json({ error: "Not signed in" }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Invalid summary" }, 400);
    const s = parsed.data;

    let html = `<h1>Daily Point Summary for ${escapeHtml(s.date)}</h1><h2>Total Points: ${s.totalPoints}</h2>`;
    for (const c of s.categories) {
      html += `<h3>${escapeHtml(c.name)}: ${c.points} points</h3><ul>`;
      for (const e of c.entries) {
        html += `<li><strong>${escapeHtml(e.description || c.name)}:</strong> ${e.points} points</li>`;
      }
      html += `</ul>`;
    }

    // Always sent to the signed-in user's own address.
    const result = await resend.emails.send({
      from: "Family Hub <onboarding@resend.dev>",
      to: [caller.user.email],
      subject: `Daily Points Summary for ${s.date.replace(/[\r\n]/g, " ")}`,
      html,
    });
    return json({ ok: true, id: (result as { data?: { id?: string } })?.data?.id ?? null });
  } catch (e) {
    console.error("send-email failed", e);
    return json({ error: "Unable to send email" }, 500);
  }
});
