import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { escapeHtml } from "../_shared/auth.ts";

const APP_ORIGIN = (Deno.env.get("APP_ORIGIN") ?? "https://reward-point-tracker.lovable.app").replace(/\/$/, "");
const ALLOWED_ORIGINS = new Set([APP_ORIGIN, "https://id-preview--6d6906c6-162c-45ae-b910-47ebf987bb28.lovable.app"]);

const Body = z.object({ email: z.string().trim().email().max(255), origin: z.string().url().max(300) });

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Not signed in" }, 401);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Enter a valid email" }, 400);
    const { email, origin } = parsed.data;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Not signed in" }, 401);

    const { data: token, error } = await supabase.rpc("create_family_invite", { _email: email });
    if (error) return json({ error: error.message }, 400);

    const { data: fam } = await supabase.from("families").select("name").maybeSingle();
    const base = ALLOWED_ORIGINS.has(origin.replace(/\/$/, "")) ? origin.replace(/\/$/, "") : APP_ORIGIN;
    const link = `${base}/join?token=${encodeURIComponent(String(token))}`;
    const familyName = (fam?.name ?? "a family").replace(/[\r\n]/g, " ").slice(0, 100);
    const safeName = escapeHtml(familyName);

    let emailSent = false;
    let emailError: string | null = null;
    const key = Deno.env.get("RESEND_API_KEY");
    if (key) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Family Hub <onboarding@resend.dev>",
          to: [email],
          subject: `You're invited to join ${familyName} on Family Hub`,
          html: `<p>You've been invited to join <strong>${safeName}</strong> on Family Hub.</p>
<p><a href="${escapeHtml(link)}">Accept the invite</a></p><p>This link expires in 7 days.</p>`,
        }),
      });
      emailSent = res.ok;
      if (!res.ok) {
        emailError = await res.text();
        console.error(`Resend failed [${res.status}]: ${emailError}`);
      }
    }
    return json({ link, emailSent, emailError });
  } catch (e) {
    console.error(e);
    return json({ error: "Unable to send invite" }, 500);
  }
});
