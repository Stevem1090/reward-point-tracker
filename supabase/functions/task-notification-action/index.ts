import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { verifyTaskActionToken } from '../_shared/taskActionToken.ts';

const BodySchema = z.object({
  taskId: z.string().uuid(),
  token: z.string().min(20).max(300),
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Invalid task action' }, 400);

    const secret = Deno.env.get('TASK_ACTION_SIGNING_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!secret || !supabaseUrl || !serviceRoleKey) return json({ error: 'Task actions are not configured' }, 500);

    const { taskId, token } = parsed.data;
    if (!(await verifyTaskActionToken(taskId, token, secret))) return json({ error: 'This action has expired' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const completedAt = new Date().toISOString();
    const { data, error } = await admin
      .from('tasks')
      .update({ done: true, done_at: completedAt })
      .eq('id', taskId)
      .eq('done', false)
      .select('id, family_id')
      .maybeSingle();
    if (error) throw error;
    if (data) {
      // Clear this reminder (and its backup copy) from the family's other Android phones.
      const { data: key } = await admin.from('internal_settings').select('value').eq('key', 'push_internal_key').maybeSingle();
      if (key?.value) {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Key': key.value as string, Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ kind: 'task-sync', taskId, familyId: data.family_id }),
        }).catch((e) => console.error('task sync after mark done failed', e));
      }
    }
    return json({ completed: Boolean(data) });
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to complete this task' }, 500);
  }
});