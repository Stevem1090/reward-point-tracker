import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

/** Returns the signed-in caller and a client scoped to their session (RLS applies), or null. */
export async function getCaller(req: Request): Promise<{ user: User; client: SupabaseClient } | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await client.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  return { user: data.user, client };
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
