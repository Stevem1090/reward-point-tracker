import React, { useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Check } from 'lucide-react';
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
const DOUBLE_TAP_MS = 300;

export const ChoreCard: React.FC<ChoreCardProps> = ({ chore, year, onLog, onUndo, onDelete }) => {
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const movedRef = useRef(false);
  const [pressing, setPressing] = React.useState(false);

  const isWeekly = chore.frequency === 'weekly';
  const periodLabel = isWeekly ? 'week' : 'month';

  const getPeriod = () => {
    if (isWeekly) {
      const { start, end } = getThisWeekBounds();
      return { start, end };
    }
    const now = new Date();
    return { start: startOfMonth(now), end: endOfMonth(now) };
  };

  const { start: periodStart, end: periodEnd } = getPeriod();
  const doneThisPeriod = chore.completions.some((c) => {
    const t = new Date(c.completed_at);
    return t >= periodStart && t <= periodEnd;
  });

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPressing(false);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    longPressedRef.current = false;
    movedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setPressing(true);
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setPressing(false);
      const { start, end } = getPeriod();
      onUndo(chore.id, start, end);
      if ('vibrate' in navigator) navigator.vibrate?.(20);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPosRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE) {
      movedRef.current = true;
      clearTimer();
    }
  };

  const handlePointerUp = () => {
    const wasLong = longPressedRef.current;
    const wasMoved = movedRef.current;
    clearTimer();
    if (wasLong || wasMoved) {
      lastTapRef.current = 0;
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      onLog(chore.id);
      if ('vibrate' in navigator) navigator.vibrate?.(10);
    } else {
      lastTapRef.current = now;
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
    <Card className="p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2 flex-1">
          <p className="font-medium truncate text-sm">
            {chore.name}
            <span className="text-xs text-muted-foreground font-normal ml-1.5 capitalize">· {chore.frequency}</span>
          </p>
          <span
            className={cn(
              'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5',
              doneThisPeriod
                ? 'bg-kid-purple text-white'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {doneThisPeriod ? (
              <>
                <Check className="h-2.5 w-2.5" /> This {periodLabel}
              </>
            ) : (
              <>This {periodLabel}: —</>
            )}
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={() => onDelete(chore.id)}
          aria-label="Delete chore"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Double-tap to log completion. Long-press to undo last ${periodLabel} entry.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerCancel}
        onPointerCancel={handlePointerCancel}
        onContextMenu={handleContextMenu}
        className={cn(
          'cursor-pointer rounded-md p-0.5 -m-0.5 transition-transform touch-none',
          pressing && 'scale-[0.98] opacity-90'
        )}
      >
        <ChoreGrid
          frequency={chore.frequency as 'weekly' | 'monthly'}
          year={year}
          completions={chore.completions}
        />
      </div>
    </Card>
  );
};
