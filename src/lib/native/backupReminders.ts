import { supabase } from '@/integrations/supabase/client';
import { FamilyHub, isNativeApp } from './platform';

import { computeBackupReminders, type ReminderTask } from './backupRules';

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
