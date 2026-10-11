import { describe, expect, test } from 'bun:test';
import { computeBackupReminders } from '../src/lib/native/backupRules';

const now = Date.parse('2026-10-11T08:00:00Z');
const me = 'steve';
const base = { notes: null, done: false, is_private: false, owner_id: 'tasha', assigned_to: null, notified_at: null };
const at = (h: number) => new Date(now + h * 3600_000).toISOString();

describe('phone backup reminders', () => {
  test('shared, unassigned task due soon gets a backup', () => {
    expect(computeBackupReminders([{ ...base, id: 'a', title: 'A', due_at: at(2) }], me, now).map((r) => r.taskId)).toEqual(['a']);
  });
  test('task assigned to someone else is skipped', () => {
    expect(computeBackupReminders([{ ...base, id: 'b', title: 'B', due_at: at(2), assigned_to: 'tasha' }], me, now)).toHaveLength(0);
  });
  test("someone else's private task is skipped", () => {
    expect(computeBackupReminders([{ ...base, id: 'c', title: 'C', due_at: at(2), is_private: true }], me, now)).toHaveLength(0);
  });
  test('done, already-sent, past and beyond-7-day tasks are skipped', () => {
    const tasks = [
      { ...base, id: 'd', title: 'D', due_at: at(2), done: true },
      { ...base, id: 'e', title: 'E', due_at: at(2), notified_at: at(0) },
      { ...base, id: 'f', title: 'F', due_at: at(-1) },
      { ...base, id: 'g', title: 'G', due_at: at(24 * 7 + 1) },
    ];
    expect(computeBackupReminders(tasks, me, now)).toHaveLength(0);
  });
});
