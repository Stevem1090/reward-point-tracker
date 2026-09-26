import { format } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export const TASK_TIME_ZONE = 'Europe/London';

export function taskLocalParts(instant: string) {
  const londonDate = toZonedTime(new Date(instant), TASK_TIME_ZONE);
  return {
    date: format(londonDate, 'yyyy-MM-dd'),
    time: format(londonDate, 'HH:mm'),
  };
}

export function taskLocalToIso(date: string, time = '09:00') {
  return fromZonedTime(`${date}T${time}:00`, TASK_TIME_ZONE).toISOString();
}

export function formatTaskDue(instant: string, now = new Date()) {
  const due = toZonedTime(new Date(instant), TASK_TIME_ZONE);
  const londonNow = toZonedTime(now, TASK_TIME_ZONE);
  const dueDay = format(due, 'yyyy-MM-dd');
  const today = format(londonNow, 'yyyy-MM-dd');
  const tomorrow = format(new Date(londonNow.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const time = format(due, 'HH:mm');

  if (dueDay === today) return `Today ${time}`;
  if (dueDay === tomorrow) return `Tomorrow ${time}`;
  return format(due, 'EEE d MMM, HH:mm');
}
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly';
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function repeatLabel(repeat: TaskRepeat, weekday: number | null, day: number | null) {
  if (repeat === 'daily') return 'Daily';
  if (repeat === 'weekly') return `Every ${WEEKDAYS[weekday ?? 1].slice(0, 3)}`;
  if (repeat === 'monthly') return `Monthly on ${ordinal(day ?? 1)}`;
  return '';
}

/** First matching London date from today (inclusive) for a repeat rule. */
export function firstOccurrenceDate(repeat: TaskRepeat, weekday: number | null, day: number | null, now = new Date()) {
  const today = toZonedTime(now, TASK_TIME_ZONE);
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (repeat === 'weekly') {
    d.setDate(d.getDate() + (((weekday ?? 1) - d.getDay() + 7) % 7));
  } else if (repeat === 'monthly') {
    const target = day ?? 1;
    const clamp = (y: number, m: number) => new Date(y, m, Math.min(target, new Date(y, m + 1, 0).getDate()));
    let c = clamp(d.getFullYear(), d.getMonth());
    if (c < d) c = clamp(d.getFullYear(), d.getMonth() + 1);
    return format(c, 'yyyy-MM-dd');
  }
  return format(d, 'yyyy-MM-dd');
}
