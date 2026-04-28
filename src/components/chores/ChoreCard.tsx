import React, { useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { ChoreWithCompletions } from '@/types/chore';
import { ChoreGrid } from './ChoreGrid';
import { getThisWeekBounds } from '@/utils/getWeekBounds';
import { startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface ChoreCardProps {
  chore: ChoreWithCompletions;
  year: number;
  onLog: (id: string) => void;
  onUndo: (id: string, start: Date, end: Date) => void;
  onDelete: (id: string) => void;
}

const LONG_PRESS_MS = 600;
const MOVE_TOLERANCE = 10;

export const ChoreCard: React.FC<ChoreCardProps> = ({ chore, year, onLog, onUndo, onDelete }) => {
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const [pressing, setPressing] = React.useState(false);

  const getPeriod = () => {
    if (chore.frequency === 'weekly') {
      const { start, end } = getThisWeekBounds();
      return { start, end };
    }
    const now = new Date();
    return { start: startOfMonth(now), end: endOfMonth(now) };
  };

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPressing(false);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    longPressedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setPressing(true);
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setPressing(false);
      const { start, end } = getPeriod();
      onUndo(chore.id, start, end);
      // haptic feedback
      if ('vibrate' in navigator) navigator.vibrate?.(20);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPosRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE) clearTimer();
  };

  const handlePointerUp = () => {
    const wasLong = longPressedRef.current;
    clearTimer();
    if (!wasLong) {
      onLog(chore.id);
    }
  };

  const handlePointerCancel = () => {
    longPressedRef.current = false;
    clearTimer();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const { start, end } = getPeriod();
    onUndo(chore.id, start, end);
  };

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{chore.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{chore.frequency}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-11 w-11 shrink-0"
          onClick={() => onDelete(chore.id)}
          aria-label="Delete chore"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Tap to log completion. Long-press to undo last ${chore.frequency === 'weekly' ? 'week' : 'month'} entry.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerCancel}
        onPointerCancel={handlePointerCancel}
        onContextMenu={handleContextMenu}
        className={cn(
          'cursor-pointer rounded-md p-1 -m-1 transition-transform touch-none',
          pressing && 'scale-[0.98] opacity-90'
        )}
      >
        <ChoreGrid
          frequency={chore.frequency as 'weekly' | 'monthly'}
          year={year}
          completions={chore.completions}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tap the grid to log. Long-press to undo your last entry this {chore.frequency === 'weekly' ? 'week' : 'month'}.
      </p>
    </Card>
  );
};
