import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { ChoreWithCompletions } from '@/types/chore';
import { ChoreGrid } from './ChoreGrid';
import { getThisWeekBounds } from '@/utils/getWeekBounds';
import { startOfMonth, endOfMonth } from 'date-fns';

interface ChoreCardProps {
  chore: ChoreWithCompletions;
  year: number;
  onLog: (id: string) => void;
  onUndo: (id: string, start: Date, end: Date) => void;
  onDelete: (id: string) => void;
}

export const ChoreCard: React.FC<ChoreCardProps> = ({ chore, year, onLog, onUndo, onDelete }) => {
  const handleTap = () => onLog(chore.id);
  const handleUndo = () => {
    if (chore.frequency === 'weekly') {
      const { start, end } = getThisWeekBounds();
      onUndo(chore.id, start, end);
    } else {
      const now = new Date();
      onUndo(chore.id, startOfMonth(now), endOfMonth(now));
    }
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
      <ChoreGrid
        frequency={chore.frequency as 'weekly' | 'monthly'}
        year={year}
        completions={chore.completions}
        onTapCurrent={handleTap}
        onUndoCurrent={handleUndo}
      />
      <p className="text-[11px] text-muted-foreground">
        Tap the highlighted box to log a completion. Long-press / right-click to undo.
      </p>
    </Card>
  );
};
