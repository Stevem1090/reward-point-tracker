import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { Chore } from '@/types/chore';
import { cn } from '@/lib/utils';

interface AdhocChoreRowProps {
  chore: Chore;
  onToggle: (chore: Chore) => void;
  onDelete: (id: string) => void;
}

export const AdhocChoreRow: React.FC<AdhocChoreRowProps> = ({ chore, onToggle, onDelete }) => {
  const done = !!chore.completed_at;
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card',
        done && 'opacity-60 bg-muted/40'
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={() => onToggle(chore)}
        className="h-5 w-5"
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
      />
      <span className={cn('flex-1 min-w-0 truncate', done && 'line-through text-muted-foreground')}>
        {chore.name}
      </span>
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
  );
};
