import { startOfWeek, endOfWeek, addWeeks, format, parseISO, isWithinInterval } from 'date-fns';

/**
 * Get the Monday (start) and Sunday (end) of a week containing a given date
 */
export function getWeekBounds(date: Date = new Date()): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 }); // Sunday
  return { start, end };
}

/**
 * Get week bounds for "this week" (current week)
 */
export function getThisWeekBounds(): { start: Date; end: Date } {
  return getWeekBounds(new Date());
}

/**
 * Get week bounds for "next week"
 */
export function getNextWeekBounds(): { start: Date; end: Date } {
  const nextWeek = addWeeks(new Date(), 1);
  return getWeekBounds(nextWeek);
}

/**
 * Get the Monday date string (YYYY-MM-DD) for a given date's week
 */
export function getWeekStartDate(date: Date = new Date()): string {
  const { start } = getWeekBounds(date);
  return format(start, 'yyyy-MM-dd');
}

/**
 * Format a week range for display (e.g., "13-19 Jan")
 */
export function formatWeekRange(weekStartDate: string | Date): string {
  const start = typeof weekStartDate === 'string' ? parseISO(weekStartDate) : weekStartDate;
  const end = endOfWeek(start, { weekStartsOn: 1 });
  
  const startDay = format(start, 'd');
  const endDay = format(end, 'd');
  const month = format(end, 'MMM');
  
  // If same month
  if (format(start, 'M') === format(end, 'M')) {
    return `${startDay}-${endDay} ${month}`;
  }
  
  // Different months
  return `${startDay} ${format(start, 'MMM')} - ${endDay} ${month}`;
}

/**
 * Check if a date string is in "this week"
 */
export function isThisWeek(weekStartDate: string): boolean {
  const thisWeekStart = getWeekStartDate();
  return weekStartDate === thisWeekStart;
}

/**
 * Check if a date string is in "next week"
 */
export function isNextWeek(weekStartDate: string): boolean {
  const nextWeek = addWeeks(new Date(), 1);
  const nextWeekStart = getWeekStartDate(nextWeek);
  return weekStartDate === nextWeekStart;
}

/**
 * Get label for a week ("This Week", "Next Week", or date range)
 */
export function getWeekLabel(weekStartDate: string): string {
  if (isThisWeek(weekStartDate)) {
    return `This Week: ${formatWeekRange(weekStartDate)}`;
  }
  if (isNextWeek(weekStartDate)) {
    return `Next Week: ${formatWeekRange(weekStartDate)}`;
  }
  return formatWeekRange(weekStartDate);
}
