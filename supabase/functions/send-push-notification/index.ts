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

// Time-to-live per notification type (seconds). How long Google holds an undelivered message.
const TTL_SECONDS = {
  taskReminder: 14400, // 4 hours
  assignment: 86400,   // 24 hours
  freezer: 86400,      // 24 hours
  test: 300,           // 5 minutes
} as const;
type NotifKind = keyof typeof TTL_SECONDS;

// Stable de-dup key per notification type + item: 4-char prefix + base64url of the
// item UUID's 16 raw bytes (22 chars, no padding) = 26 chars, within the 32-char limit.
function topicFor(kind: NotifKind, itemId?: string): string | undefined {
  if (kind === "test" || !itemId) return undefined; // test pushes: unique each time, no topic/tag
  const prefix = { taskReminder: "rem_", assignment: "asg_", freezer: "frz_" }[kind];
  const hex = itemId.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) return undefined;
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${prefix}${b64}`;
}

type Admin = ReturnType<typeof createClient>;

type TaskAction = { taskId: string; token: string };

async function sendToUsers(admin: Admin, userIds: string[], title: string, body: string, url = "/", taskAction?: TaskAction, kind: NotifKind = "test", itemId?: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const FCM_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
  if (!LOVABLE_API_KEY || !FCM_KEY) throw new Error("Push is not configured");

  const { data: tokens, error } = await admin.from("push_tokens").select("id, token").in("user_id", userIds);
  if (error) throw error;

  const topic = topicFor(kind, itemId);
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
            headers: {
              Urgency: "high",
              TTL: String(TTL_SECONDS[kind]),
              ...(topic ? { Topic: topic } : {}),
            },
            fcm_options: { link: absoluteUrl(url) },
            notification: {
              icon: `${APP_ORIGIN}/icons/icon-192.png`,
              badge: `${APP_ORIGIN}/icons/notification-96.png`,
              ...(topic ? { tag: topic, renotify: true } : {}),
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
      console.log(`FCM send OK [kind=${kind}${itemId ? ` item=${itemId}` : ""} subscription=${t.id}]`);
    } else {
      const text = await res.text();
      console.error(`FCM send failed [${res.status}] [kind=${kind}${itemId ? ` item=${itemId}` : ""} subscription=${t.id}]: ${text}`);
      // Only delete subscriptions that are definitively dead. 400/INVALID_ARGUMENT can
      // mean a malformed payload, so log it in full but keep the subscription.
      if (res.status === 404 || res.status === 410 || text.includes("UNREGISTERED")) {
        stale.push(t.id);
      }
    }
  }
  if (stale.length) {
    await admin.from("push_tokens").delete().in("id", stale);
    console.log(`Removed ${stale.length} dead push subscription(s): ${stale.join(", ")}`);
  }
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
        "taskReminder",
        task.id,
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
    "assignment",
    task.id as string,
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
