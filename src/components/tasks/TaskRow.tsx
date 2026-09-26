import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, Lock, Bell, X, Repeat } from 'lucide-react';
import { isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Task } from '@/hooks/useTasks';
import { formatTaskDue, repeatLabel } from '@/lib/tasks/dateTime';

export function formatDue(due: string) {
  return formatTaskDue(due);
}

interface Props {
  task: Task;
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  onDelete: (id: string) => void;
  draggable?: boolean;
}

export const TaskRow: React.FC<Props> = ({ task, onToggle, onOpen, onDelete, draggable = true }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task:${task.id}`,
    data: { type: 'task', task },
    disabled: !draggable,
  });
  const overdue = task.due_at && !task.done && isPast(new Date(task.due_at));

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-start gap-1 rounded-md bg-card group',
        isDragging && 'opacity-50 shadow-lg relative z-10'
      )}
    >
      {draggable ? (
        <button
          {...attributes}
          {...listeners}
          className="touch-none h-11 w-7 flex items-center justify-center text-muted-foreground/60 cursor-grab active:cursor-grabbing shrink-0"
          aria-label="Drag task"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span className="w-7 shrink-0" />
      )}
      <div className="h-11 flex items-center shrink-0">
        <Checkbox
          checked={task.done}
          onCheckedChange={() => onToggle(task)}
          aria-label={task.done ? 'Mark not done' : 'Mark done'}
          className="h-5 w-5"
        />
      </div>
      <button onClick={() => onOpen(task)} className="flex-1 min-w-0 text-left py-2.5 pl-2 pr-1 min-h-[44px]">
        <span className={cn('block break-words', task.done && 'line-through text-muted-foreground')}>{task.title}</span>
        {(task.due_at || task.is_private || task.notes) && (
          <span className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
            {task.due_at && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
                  overdue && 'border-destructive text-destructive'
                )}
              >
                <Bell className="h-3 w-3" />
                {formatDue(task.due_at)}
              </span>
            )}
            {task.repeat && task.repeat !== 'none' && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="h-3 w-3" />{' '}
                {repeatLabel(task.repeat, task.repeat_interval, task.repeat_days, task.repeat_month_days)}
              </span>
            )}
            {task.is_private && (
              <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Only me</span>
            )}
            {task.notes && <span className="truncate max-w-[12rem]">{task.notes}</span>}
          </span>
        )}
      </button>
      <button
        onClick={() => onDelete(task.id)}
        className="h-11 w-11 flex items-center justify-center shrink-0 text-muted-foreground/60 hover:text-destructive"
        aria-label="Delete task"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
