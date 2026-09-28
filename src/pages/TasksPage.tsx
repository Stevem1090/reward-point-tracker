import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent, KeyboardSensor, PointerSensor, TouchSensor,
  closestCorners, useSensor, useSensors, CollisionDetection,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Loader2, Rows3, Columns3 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks, type Task, type TaskSection } from '@/hooks/useTasks';
import { TaskSectionCard } from '@/components/tasks/TaskSectionCard';
import { TaskDialog } from '@/components/tasks/TaskDialog';

type Order = Record<string, string[]>; // sectionId -> active task ids

const TasksPage = () => {
  const { user } = useAuth();
  const t = useTasks();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<Task | null>(null);
  const [sectionDialog, setSectionDialog] = useState<{ mode: 'add' | 'rename'; section?: TaskSection } | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [toDelete, setToDelete] = useState<TaskSection | null>(null);
  const [dragType, setDragType] = useState<'task' | 'section' | null>(null);
  const [order, setOrder] = useState<Order>({});
  const [hideReminders, setHideReminders] = useState(false);
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [view, setView] = useState<'list' | 'board'>(() => (localStorage.getItem('tasks_view') === 'board' ? 'board' : 'list'));
  useEffect(() => { localStorage.setItem('tasks_view', view); }, [view]);


  useEffect(() => {
    const taskId = searchParams.get('task');
    if (!taskId || t.isLoading) return;
    const task = t.tasks.find((candidate) => candidate.id === taskId);
    if (task) setEditing(task);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, t.isLoading, t.tasks]);

  const byId = useMemo(() => new Map(t.tasks.map((x) => [x.id, x])), [t.tasks]);

  // Rebuild order from data whenever not dragging
  useEffect(() => {
    if (dragType) return;
    const o: Order = {};
    t.sections.forEach((s) => (o[s.id] = []));
    t.tasks
      .filter((x) => !x.done)
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((x) => o[x.section_id]?.push(x.id));
    setOrder(o);
  }, [t.tasks, t.sections, dragType]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Sections only collide with sections; tasks only with tasks / section drop zones
  const collision: CollisionDetection = (args) => {
    const type = args.active.data.current?.type;
    const containers = args.droppableContainers.filter((c) => {
      const ct = c.data.current?.type;
      return type === 'section' ? ct === 'section' : ct === 'task' || ct === 'drop';
    });
    return closestCorners({ ...args, droppableContainers: containers });
  };

  const containerOf = (id: string): string | undefined => {
    if (id.startsWith('drop:')) return id.slice(5);
    if (id.startsWith('section:')) return id.slice(8);
    const taskId = id.replace('task:', '');
    return Object.keys(order).find((s) => order[s].includes(taskId));
  };

  const onDragStart = (e: DragStartEvent) => setDragType(e.active.data.current?.type ?? null);

  const onDragOver = (e: DragOverEvent) => {
    if (dragType !== 'task' || !e.over) return;
    const activeId = String(e.active.id).replace('task:', '');
    const from = containerOf(String(e.active.id));
    const to = containerOf(String(e.over.id));
    if (!from || !to || from === to) return;
    setOrder((prev) => {
      const fromList = prev[from].filter((id) => id !== activeId);
      const toList = [...prev[to]];
      const overIdx = toList.indexOf(String(e.over!.id).replace('task:', ''));
      toList.splice(overIdx >= 0 ? overIdx : toList.length, 0, activeId);
      return { ...prev, [from]: fromList, [to]: toList };
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const type = dragType;
    const { active, over } = e;
    if (type === 'section') {
      setDragType(null);
      if (!over || active.id === over.id) return;
      const ids = t.sections.map((s) => `section:${s.id}`);
      const moved = arrayMove(t.sections, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
      t.saveSectionOrder(moved);
      return;
    }
    if (type === 'task') {
      let next = order;
      if (over) {
        const container = containerOf(String(active.id));
        const activeId = String(active.id).replace('task:', '');
        const overId = String(over.id).replace('task:', '');
        if (container && over.id !== active.id && order[container].includes(overId)) {
          const list = order[container];
          next = { ...order, [container]: arrayMove(list, list.indexOf(activeId), list.indexOf(overId)) };
        }
      }
      const updated = t.tasks.map((task) => {
        for (const sid of Object.keys(next)) {
          const idx = next[sid].indexOf(task.id);
          if (idx >= 0) return { ...task, section_id: sid, sort_order: idx };
        }
        return task;
      });
      setOrder(next);
      t.saveTaskOrder(updated);
    }
    setDragType(null);
  };

  const toggle = (task: Task) => t.updateTask(task.id, { done: !task.done, done_at: !task.done ? new Date().toISOString() : null });

  const openSectionDialog = (mode: 'add' | 'rename', section?: TaskSection) => {
    setSectionName(section?.name ?? '');
    setSectionDialog({ mode, section });
  };
  const saveSection = () => {
    const name = sectionName.trim();
    if (!name || !sectionDialog) return;
    if (sectionDialog.mode === 'add') t.addSection(name);
    else if (sectionDialog.section) t.renameSection(sectionDialog.section.id, name);
    setSectionDialog(null);
  };

  if (t.isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const visible = (x: Task) =>
    (!hideReminders || !x.due_at) && (!assignedOnly || (!!user && x.assigned_to === user.id));
  const sectionData = t.sections.map((s) => ({
    s,
    active: (order[s.id] ?? []).map((id) => byId.get(id)).filter((x): x is Task => !!x && visible(x)),
    completed: t.tasks.filter((x) => x.section_id === s.id && x.done && visible(x)).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')),
  })).filter((d) => !assignedOnly || d.active.length + d.completed.length > 0);

  return (
    <div className={cn('mx-auto px-3 pb-24', view === 'board' ? 'max-w-none' : 'container max-w-2xl')}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as 'list' | 'board')} variant="outline">
            <ToggleGroupItem value="list" aria-label="Stacked view" className="h-11 w-11"><Rows3 className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="board" aria-label="Board view" className="h-11 w-11"><Columns3 className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" onClick={() => openSectionDialog('add')} className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-1" /> Section
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-4 rounded-xl border bg-card px-3 py-1">
        <label className="flex items-center gap-2 min-h-[44px] text-sm cursor-pointer">
          <Switch checked={assignedOnly} onCheckedChange={setAssignedOnly} />
          Assigned to me
        </label>
        <label className="flex items-center gap-2 min-h-[44px] text-sm cursor-pointer">
          <Switch checked={hideReminders} onCheckedChange={setHideReminders} />
          Hide reminders
        </label>
      </div>

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setDragType(null)}>
        <SortableContext items={sectionData.map((d) => `section:${d.s.id}`)} strategy={view === 'board' ? horizontalListSortingStrategy : verticalListSortingStrategy}>
          <div className={view === 'board'
            ? 'flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-3 px-3 items-start'
            : 'space-y-4'}>
            {sectionData.map(({ s, active, completed }) => (
              <div key={s.id} className={view === 'board' ? 'snap-start shrink-0 w-[85vw] max-w-sm' : undefined}>
              <TaskSectionCard
                section={s}
                active={active}
                completed={completed}
                onAdd={(sectionId, title, isPrivate) => t.addTask({ section_id: sectionId, title, is_private: isPrivate })}
                onToggle={toggle}
                onOpen={setEditing}
                onDeleteTask={t.deleteTask}
                onRename={(sec) => openSectionDialog('rename', sec)}
                onDelete={setToDelete}
              />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {assignedOnly && sectionData.length === 0 && t.sections.length > 0 && (
        <p className="text-center text-muted-foreground py-10">Nothing assigned to you right now.</p>
      )}

      {t.sections.length === 0 && (
        <p className="text-center text-muted-foreground py-10">No sections yet. Add one to get started.</p>
      )}

      <TaskDialog
        task={editing}
        sections={t.sections}
        currentUserId={user?.id}
        onClose={() => setEditing(null)}
        onSave={t.updateTask}
        onDelete={t.deleteTask}
      />

      <Dialog open={!!sectionDialog} onOpenChange={(o) => !o && setSectionDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{sectionDialog?.mode === 'add' ? 'New section' : 'Rename section'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveSection(); }}>
            <Input autoFocus value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="e.g. This weekend" />
          </form>
          <DialogFooter><Button onClick={saveSection}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>All tasks in this section will be deleted too.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toDelete) t.deleteSection(toDelete.id); setToDelete(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TasksPage;
