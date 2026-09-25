import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

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
    const link = `${origin}/join?token=${token}`;
    const familyName = fam?.name ?? "a family";

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
          html: `<p>You've been invited to join <strong>${familyName}</strong> on Family Hub.</p>
<p><a href="${link}">Accept the invite</a></p><p>This link expires in 7 days.</p>`,
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
    return json({ error: (e as Error).message }, 500);
  }
});
