// Sends push notifications through Firebase Cloud Messaging (via the Lovable connector gateway).
// Modes:
//  - { userIds, title, body, url? }  -> send to those users' devices (used by reminders / freezer alerts / test button)
//  - { kind: "tasks" }               -> send due task reminders (called every minute by cron)
import { createClient } from "npm:@supabase/supabase-js@2";
import { createTaskActionToken } from "../_shared/taskActionToken.ts";
import { getCaller } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-source, x-internal-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
// Absolute origin for notification images/links: Android resolves these while the app is closed.
const APP_ORIGIN = (Deno.env.get("APP_ORIGIN") ?? "https://reward-point-tracker.lovable.app").replace(/\/$/, "");
const absoluteUrl = (u: string) => (/^https?:\/\//.test(u) ? u : `${APP_ORIGIN}${u.startsWith("/") ? u : `/${u}`}`);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Admin = ReturnType<typeof createClient>;

type TaskAction = { taskId: string; token: string };

async function sendToUsers(admin: Admin, userIds: string[], title: string, body: string, url = "/", taskAction?: TaskAction) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const FCM_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
  if (!LOVABLE_API_KEY || !FCM_KEY) throw new Error("Push is not configured");

  const { data: tokens, error } = await admin.from("push_tokens").select("id, token").in("user_id", userIds);
  if (error) throw error;

  let sent = 0;
  const stale: string[] = [];
  for (const t of tokens ?? []) {
    const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": FCM_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: t.token,
          notification: body ? { title, body } : { title },
          data: {
            url,
            ...(taskAction ? {
              taskId: taskAction.taskId,
              actionToken: taskAction.token,
              actionUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/task-notification-action`,
            } : {}),
          },
          webpush: {
            fcm_options: { link: absoluteUrl(url) },
            notification: {
              icon: `${APP_ORIGIN}/icons/icon-192.png`,
              badge: `${APP_ORIGIN}/icons/notification-96.png`,
              ...(taskAction ? { actions: [
                { action: "mark-done", title: "Mark done" },
                { action: "view-task", title: "View task" },
              ] } : {}),
            },
          },
        },
      }),
    });
    if (res.ok) {
      sent++;
    } else {
      const text = await res.text();
      console.error(`FCM send failed [${res.status}]: ${text}`);
      if (res.status === 404 || (res.status === 400 && text.includes("INVALID_ARGUMENT")) || text.includes("UNREGISTERED")) {
        stale.push(t.id);
      }
    }
  }
  if (stale.length) await admin.from("push_tokens").delete().in("id", stale);
  return { sent, devices: tokens?.length ?? 0, removed: stale.length };
}

async function sendTaskReminders(admin: Admin) {
  const actionSecret = Deno.env.get("TASK_ACTION_SIGNING_SECRET");
  if (!actionSecret) throw new Error("Task actions are not configured");
  const { error: rollError } = await admin.rpc("roll_recurring_tasks");
  if (rollError) console.error("roll_recurring_tasks failed", rollError);
  const { data: tasks, error } = await admin
    .from("tasks")
    .select("id, title, notes, is_private, owner_id, family_id, assigned_to")
    .eq("done", false)
    .is("notified_at", null)
    .not("due_at", "is", null)
    .lte("due_at", new Date().toISOString())
    .limit(50);
  if (error) throw error;
  if (!tasks?.length) return { tasks: 0 };

  const familyCache = new Map<string, string[]>();
  for (const task of tasks) {
    // Mark first so a slow send never double-notifies
    await admin.from("tasks").update({ notified_at: new Date().toISOString() }).eq("id", task.id).is("notified_at", null);
    let recipients: string[];
    if (task.is_private) {
      recipients = [task.owner_id];
    } else if (task.assigned_to) {
      recipients = [task.assigned_to as string];
    } else {
      if (!familyCache.has(task.family_id)) {
        const { data } = await admin.from("family_members").select("user_id").eq("family_id", task.family_id);
        familyCache.set(task.family_id, (data ?? []).map((r: { user_id: string }) => r.user_id));
      }
      recipients = familyCache.get(task.family_id)!;
    }
    if (recipients.length) {
      const actionToken = await createTaskActionToken(task.id, actionSecret);
      await sendToUsers(
        admin,
        recipients,
        task.title,
        task.notes || "",
        `/tasks?task=${task.id}`,
        { taskId: task.id, token: actionToken },
      );
    }
  }
  return { tasks: tasks.length };
}

// Tells the assignee "<Name> assigned you a task", with the same Mark done / View actions.
async function sendAssignmentNotice(admin: Admin, req: Request, taskId: string) {
  const actionSecret = Deno.env.get("TASK_ACTION_SIGNING_SECRET");
  if (!actionSecret) throw new Error("Task actions are not configured");

  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: caller } = await admin.auth.getUser(jwt);
  const assignerId = caller?.user?.id;
  if (!assignerId) return { sent: 0, reason: "not signed in" };

  const { data: task } = await admin
    .from("tasks")
    .select("id, title, notes, due_at, assigned_to, family_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task?.assigned_to || task.assigned_to === assignerId) return { sent: 0, reason: "nobody to notify" };

  const { data: membership } = await admin
    .from("family_members")
    .select("user_id")
    .eq("family_id", task.family_id)
    .in("user_id", [assignerId, task.assigned_to]);
  if ((membership ?? []).length < 2) return { sent: 0, reason: "not in the same family" };

  const { data: profile } = await admin.from("user_profiles").select("name").eq("id", assignerId).maybeSingle();
  const who = (profile?.name as string | null)?.trim() || "Someone";
  const actionToken = await createTaskActionToken(task.id, actionSecret);
  return await sendToUsers(
    admin,
    [task.assigned_to as string],
    `${who} assigned you a task`,
    task.title as string,
    `/tasks?task=${task.id}`,
    { taskId: task.id as string, token: actionToken },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const payload = await req.json().catch(() => ({}));

    if (payload?.kind === "tasks") return json(await sendTaskReminders(admin));

    if (payload?.kind === "task-assigned") {
      const taskId = typeof payload.taskId === "string" ? payload.taskId : "";
      if (!/^[0-9a-f-]{36}$/i.test(taskId)) return json({ error: "Provide taskId" }, 400);
      return json(await sendAssignmentNotice(admin, req, taskId));
    }

    const userIds = payload.userIds || payload.familyMemberIds || (payload.userId ? [payload.userId] : undefined);
    const title = typeof payload.title === "string" ? payload.title.slice(0, 200) : "";
    const body = typeof payload.body === "string" ? payload.body.slice(0, 1000) : "";
    const url = typeof payload.url === "string" && payload.url.startsWith("/") ? payload.url : "/";
    if (!Array.isArray(userIds) || userIds.length === 0 || !title) {
      return json({ error: "Provide userIds and title" }, 400);
    }
    let targets = userIds.filter((u: unknown): u is string => typeof u === "string" && /^[0-9a-f-]{36}$/i.test(u)).slice(0, 50);

    // Scheduled database jobs authenticate with the private internal key.
    const suppliedKey = req.headers.get("X-Internal-Key") ?? "";
    let internal = false;
    if (suppliedKey) {
      const { data: row } = await admin.from("internal_settings").select("value").eq("key", "push_internal_key").maybeSingle();
      internal = Boolean(row?.value) && row!.value === suppliedKey;
    }
    if (!internal) {
      // Signed-in users can only notify people in their own family.
      const caller = await getCaller(req);
      if (!caller) return json({ error: "Not signed in" }, 401);
      const { data: me } = await admin.from("family_members").select("family_id").eq("user_id", caller.user.id).maybeSingle();
      if (!me?.family_id) return json({ error: "Not allowed" }, 403);
      const { data: members } = await admin.from("family_members").select("user_id").eq("family_id", me.family_id);
      const allowed = new Set((members ?? []).map((m: { user_id: string }) => m.user_id));
      targets = targets.filter((u: string) => allowed.has(u));
      if (targets.length === 0) return json({ error: "Not allowed" }, 403);
    }
    return json(await sendToUsers(admin, targets, title, body, url));
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
