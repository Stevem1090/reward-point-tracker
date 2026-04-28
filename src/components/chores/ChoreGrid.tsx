import React from 'react';
import { ChoreCompletion, ChoreFrequency } from '@/types/chore';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, getISOWeek, getISOWeekYear } from 'date-fns';

interface ChoreGridProps {
  frequency: ChoreFrequency;
  year: number;
  completions: ChoreCompletion[];
}

function isoWeek1Monday(year: number): Date {
  const jan4 = new Date(year, 0, 4);
  return startOfWeek(jan4, { weekStartsOn: 1 });
}

export const ChoreGrid: React.FC<ChoreGridProps> = ({ frequency, year, completions }) => {
  const now = new Date();

  const periods: {
    index: number;
    label: string;
    count: number;
    isCurrent: boolean;
    isFuture: boolean;
  }[] = [];

  if (frequency === 'weekly') {
    const week1Monday = isoWeek1Monday(year);
    for (let i = 0; i < 52; i++) {
      const start = addWeeks(week1Monday, i);
      const end = endOfWeek(start, { weekStartsOn: 1 });
      const count = completions.filter((c) => {
        const d = new Date(c.completed_at);
        return d >= start && d <= end;
      }).length;
      const isLast = i === 51;
      const extraCount = isLast
        ? completions.filter((c) => {
            const d = new Date(c.completed_at);
            return getISOWeekYear(d) === year && getISOWeek(d) === 53;
          }).length
        : 0;
      const isCurrent = now >= start && now <= end;
      const isFuture = start > now;
      periods.push({
        index: i + 1,
        label: `Week ${i + 1} — ${format(start, 'd MMM')} to ${format(end, 'd MMM')}`,
        count: count + extraCount,
        isCurrent,
        isFuture,
      });
    }
  } else {
    for (let m = 0; m < 12; m++) {
      const start = startOfMonth(new Date(year, m, 1));
      const end = endOfMonth(start);
      const count = completions.filter((c) => {
        const d = new Date(c.completed_at);
        return d >= start && d <= end;
      }).length;
      const isCurrent = now >= start && now <= end;
      const isFuture = start > now;
      periods.push({
        index: m + 1,
        label: format(start, 'MMMM yyyy'),
        count,
        isCurrent,
        isFuture,
      });
    }
  }

  return (
    <div
      className={cn(
        'grid gap-[3px] w-full select-none',
        frequency === 'weekly' ? 'grid-cols-13' : 'grid-cols-12'
      )}
    >
      {periods.map((p) => {
        const filled = p.count > 0;
        return (
          <div
            key={p.index}
            title={`${p.label} — ${p.count} completion${p.count === 1 ? '' : 's'}`}
            className={cn(
              'aspect-square rounded-[3px] flex items-center justify-center text-[10px] font-semibold transition-colors',
              filled
                ? 'bg-kid-purple text-white'
                : p.isFuture
                ? 'bg-muted/40'
                : 'bg-muted',
              p.isCurrent && !filled && 'ring-2 ring-kid-purple/50',
              p.isCurrent && filled && 'ring-2 ring-kid-purple'
            )}
          >
            {p.count > 1 ? p.count : ''}
          </div>
        );
      })}
    </div>
  );
};
