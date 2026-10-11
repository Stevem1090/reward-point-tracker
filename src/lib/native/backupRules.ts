export type BackupReminder = { taskId: string; title: string; body: string; dueAt: number; url: string };

export type ReminderTask = {
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

