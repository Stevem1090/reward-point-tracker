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