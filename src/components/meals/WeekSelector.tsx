import { getWeekStartDate, formatWeekRange } from '@/utils/getWeekBounds';
import { addWeeks } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WeekSelectorProps {
  selectedWeek: 'this' | 'next';
  onWeekChange: (week: 'this' | 'next') => void;
}

export function WeekSelector({ selectedWeek, onWeekChange }: WeekSelectorProps) {
  const thisWeekStart = getWeekStartDate();
  const nextWeekStart = getWeekStartDate(addWeeks(new Date(), 1));

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        onClick={() => onWeekChange('this')}
        disabled={selectedWeek === 'this'}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <div className="flex gap-2">
        <button
          onClick={() => onWeekChange('this')}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-all min-h-[44px]",
            selectedWeek === 'this'
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          )}
        >
          This Week: {formatWeekRange(thisWeekStart)}
        </button>

        <button
          onClick={() => onWeekChange('next')}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-all min-h-[44px]",
            selectedWeek === 'next'
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          )}
        >
          Next Week: {formatWeekRange(nextWeekStart)}
        </button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        onClick={() => onWeekChange('next')}
        disabled={selectedWeek === 'next'}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
