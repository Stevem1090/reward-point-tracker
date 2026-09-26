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
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Monday-first order used by the day pickers. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const UNIT_LABEL: Record<Exclude<TaskRepeat, 'none'>, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function everyPart(repeat: Exclude<TaskRepeat, 'none'>, interval: number) {
  const unit = UNIT_LABEL[repeat];
  if (interval <= 1) return `Every ${unit}`;
  if (repeat === 'monthly' && interval === 6) return 'Twice a year';
  if (repeat === 'weekly' && interval === 2) return 'Every fortnight';
  return `Every ${interval} ${unit}s`;
}

export function repeatLabel(
  repeat: TaskRepeat,
  interval = 1,
  days: number[] | null = null,
  monthDays: number[] | null = null
) {
  if (!repeat || repeat === 'none') return '';
  const base = everyPart(repeat, interval || 1);
  if (repeat === 'weekly' && days?.length) {
    const names = WEEKDAY_ORDER.filter((d) => days.includes(d)).map((d) => WEEKDAYS[d].slice(0, 3));
    return `${base} · ${names.join(', ')}`;
  }
  if (repeat === 'monthly' && monthDays?.length) {
    const list = [...monthDays].sort((a, b) => a - b).map(ordinal);
    return `${base} · ${list.join(', ')}`;
  }
  return base;
}

/** First matching London date from today (inclusive) for a repeat rule. */
export function firstOccurrenceDate(
  repeat: TaskRepeat,
  days: number[] | null = null,
  monthDays: number[] | null = null,
  now = new Date()
) {
  const today = toZonedTime(now, TASK_TIME_ZONE);
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (repeat === 'weekly' && days?.length) {
    for (let i = 0; i < 7; i++) {
      const c = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      if (days.includes(c.getDay())) return format(c, 'yyyy-MM-dd');
    }
  } else if (repeat === 'monthly' && monthDays?.length) {
    const sorted = [...monthDays].sort((a, b) => a - b);
    const clamp = (y: number, m: number, day: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
    for (const day of sorted) {
      const c = clamp(d.getFullYear(), d.getMonth(), day);
      if (c >= d) return format(c, 'yyyy-MM-dd');
    }
    return format(clamp(d.getFullYear(), d.getMonth() + 1, sorted[0]), 'yyyy-MM-dd');
  }
  return format(d, 'yyyy-MM-dd');
}
