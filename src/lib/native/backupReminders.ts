import { supabase } from '@/integrations/supabase/client';
import { FamilyHub, isNativeApp, type BackupReminder } from './platform';

type ReminderTask = {
  id: string;
  title: string;
  notes: string | null;
  done: boolean;
  due_at: string | null;
  is_private: boolean;
  owner_id: string;
  assigned_to: string | null;
  notified_at?: string | null;
};

export const BACKUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Same recipient rule as the server: private -> owner, assigned -> assignee, else whole family. */
export function isRecipient(task: ReminderTask, userId: string) {
  if (task.is_private) return task.owner_id === userId;
  if (task.assigned_to) return task.assigned_to === userId;
  return true;
}

/** Reminders this phone should hold a backup copy of: open, not yet sent, due in the next 7 days. */
export function computeBackupReminders(tasks: ReminderTask[], userId: string, now = Date.now()): BackupReminder[] {
  return tasks
    .filter((t) => !t.done && t.due_at && !t.notified_at && isRecipient(t, userId))
    .map((t) => ({ t, due: new Date(t.due_at as string).getTime() }))
    .filter(({ due }) => due > now && due <= now + BACKUP_WINDOW_MS)
    .map(({ t, due }) => ({
      taskId: t.id,
      title: t.title,
      body: t.notes ?? '',
      dueAt: due,
      url: `/tasks?task=${t.id}`,
    }));
}

export async function syncBackupReminders(tasks: ReminderTask[], userId: string) {
  if (!isNativeApp() || localStorage.getItem('push-disabled')) return;
  try {
    await FamilyHub.syncReminders({ reminders: computeBackupReminders(tasks, userId) });
  } catch (e) {
    console.error('[backup reminders] sync failed', e);
  }
}

/** Tells the family's Android phones a task changed so their backup copies stay correct. */
export function broadcastTaskChange(taskId: string) {
  supabase.functions.invoke('send-push-notification', { body: { kind: 'task-sync', taskId } })
    .catch((e) => console.error('[backup reminders] broadcast failed', e));
}
