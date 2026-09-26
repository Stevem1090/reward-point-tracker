import React, { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreVertical, Plus, ChevronDown, Lock, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { TaskRow } from './TaskRow';
import type { Task, TaskSection } from '@/hooks/useTasks';

interface Props {
  section: TaskSection;
  active: Task[];
  completed: Task[];
  onAdd: (sectionId: string, title: string, isPrivate: boolean) => void;
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  onDeleteTask: (id: string) => void;
  onRename: (s: TaskSection) => void;
  onDelete: (s: TaskSection) => void;
}

export const TaskSectionCard: React.FC<Props> = ({ section, active, completed, onAdd, onToggle, onOpen, onDeleteTask, onRename, onDelete }) => {
  const [text, setText] = useState('');
  const [privateNext, setPrivateNext] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `section:${section.id}`,
    data: { type: 'section', section },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${section.id}`,
    data: { type: 'drop', sectionId: section.id },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(section.id, text.trim(), privateNext);
    setText('');
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('rounded-xl border bg-card shadow-sm', isDragging && 'opacity-60 shadow-xl z-20 relative')}
    >
      <div className="flex items-center gap-1 px-1 pt-1">
        <button
          {...attributes}
          {...listeners}
          className="touch-none h-11 w-8 flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing"
          aria-label={`Drag ${section.name} section`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <h2 className="flex-1 font-semibold text-lg truncate">{section.name}</h2>
        <span className="text-xs text-muted-foreground mr-1">{active.length}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Section options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRename(section)}><Pencil className="h-4 w-4 mr-2" /> Rename</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(section)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <form onSubmit={submit} className="flex items-center gap-1 px-2 pb-1">
        <Plus className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task"
          className="border-0 shadow-none focus-visible:ring-0 px-2 text-base"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-11 w-11 shrink-0', privateNext ? 'text-primary' : 'text-muted-foreground/60')}
          onClick={() => setPrivateNext((p) => !p)}
          aria-pressed={privateNext}
          aria-label={privateNext ? 'Only me (on)' : 'Only me (off)'}
          title="Only me"
        >
          <Lock className="h-4 w-4" />
        </Button>
      </form>

      <div ref={setDropRef} className={cn('px-1 pb-2 min-h-[12px] rounded-b-xl', isOver && 'bg-accent/40')}>
        <SortableContext items={active.map((t) => `task:${t.id}`)} strategy={verticalListSortingStrategy}>
          {active.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggle} onOpen={onOpen} onDelete={onDeleteTask} />)}
        </SortableContext>

        {completed.length > 0 && (
          <Collapsible className="mt-1 border-t pt-1">
            <CollapsibleTrigger className="group flex items-center gap-1 px-3 min-h-[44px] text-sm text-muted-foreground w-full">
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:-rotate-90" />
              {completed.length} completed
            </CollapsibleTrigger>
            <CollapsibleContent>
              {completed.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggle} onOpen={onOpen} draggable={false} />)}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
};
