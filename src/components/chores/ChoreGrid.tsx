import React from 'react';
import { ChoreCompletion, ChoreFrequency } from '@/types/chore';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths, getISOWeek, getISOWeekYear } from 'date-fns';

interface ChoreGridProps {
  frequency: ChoreFrequency; // 'weekly' | 'monthly'
  year: number;
  completions: ChoreCompletion[];
  onTapCurrent: () => void;
  onUndoCurrent: () => void;
}

/**
 * Returns the Monday of ISO week 1 for the given ISO-week-year.
 * ISO week 1 is the week containing Jan 4.
 */
function isoWeek1Monday(year: number): Date {
  const jan4 = new Date(year, 0, 4);
  return startOfWeek(jan4, { weekStartsOn: 1 });
}

export const ChoreGrid: React.FC<ChoreGridProps> = ({
  frequency,
  year,
  completions,
  onTapCurrent,
  onUndoCurrent,
}) => {
  const now = new Date();
  const totalBoxes = frequency === 'weekly' ? 52 : 12;

  // Build period buckets
  const periods: { index: number; start: Date; end: Date; label: string; count: number; isCurrent: boolean; isFuture: boolean }[] = [];

  if (frequency === 'weekly') {
    const week1Monday = isoWeek1Monday(year);
    for (let i = 0; i < 52; i++) {
      const start = addWeeks(week1Monday, i);
      const end = endOfWeek(start, { weekStartsOn: 1 });
      // Count completions whose ISO week falls in this slot
      const count = completions.filter((c) => {
        const d = new Date(c.completed_at);
        return d >= start && d <= end;
      }).length;
      // Merge week 53 completions (rare) into week 52
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
        start,
        end,
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
        start,
        end,
        label: `${format(start, 'MMMM yyyy')}`,
        count,
        isCurrent,
        isFuture,
      });
    }
  }

  return (
    <div
      className={cn(
        'grid gap-[3px] w-full',
        frequency === 'weekly' ? 'grid-cols-13' : 'grid-cols-12'
      )}
    >
      {periods.map((p) => {
        const filled = p.count > 0;
        const tip = `${p.label} — ${p.count} completion${p.count === 1 ? '' : 's'}`;
        const handleClick = () => {
          if (p.isFuture) return;
          if (!p.isCurrent) return; // only current period interactive
          onTapCurrent();
        };
        const handleContext = (e: React.MouseEvent) => {
          e.preventDefault();
          if (p.isCurrent && p.count > 0) onUndoCurrent();
        };

        return (
          <Tooltip key={p.index} delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleClick}
                onContextMenu={handleContext}
                disabled={p.isFuture || (!p.isCurrent && !filled)}
                aria-label={tip}
                className={cn(
                  'aspect-square rounded-[3px] flex items-center justify-center text-[10px] font-semibold transition-colors',
                  filled
                    ? 'bg-kid-purple text-white'
                    : p.isFuture
                    ? 'bg-muted/40'
                    : 'bg-muted',
                  p.isCurrent && !filled && 'ring-2 ring-kid-purple/50',
                  p.isCurrent && 'cursor-pointer'
                )}
              >
                {p.count > 1 ? p.count : ''}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{tip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};
