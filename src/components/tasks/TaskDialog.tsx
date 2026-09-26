import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, TaskSection } from '@/hooks/useTasks';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import {
  taskLocalParts,
  taskLocalToIso,
  firstOccurrenceDate,
  repeatLabel,
  WEEKDAYS,
  WEEKDAY_ORDER,
  UNIT_LABEL,
  type TaskRepeat,
} from '@/lib/tasks/dateTime';

interface Props {
  task: Task | null;
  sections: TaskSection[];
  currentUserId?: string;
  onClose: () => void;
  onSave: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((v) => b.includes(v));

export const TaskDialog: React.FC<Props> = ({ task, sections, currentUserId, onClose, onSave, onDelete }) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [sectionId, setSectionId] = useState('');
  const [repeat, setRepeat] = useState<TaskRepeat>('none');
  const [interval, setIntervalValue] = useState(1);
  const [days, setDays] = useState<number[]>([]);
  const [monthDays, setMonthDays] = useState<number[]>([]);
  const [initialDate, setInitialDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('none');
  const { members } = useFamilyMembers();

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes ?? '');
    const due = task.due_at ? taskLocalParts(task.due_at) : null;
    setDate(due?.date ?? '');
    setInitialDate(due?.date ?? '');
    setTime(due?.time ?? '');
    setIsPrivate(task.is_private);
    setSectionId(task.section_id);
    setRepeat(task.repeat ?? 'none');
    setIntervalValue(task.repeat_interval || 1);
    const d = due ? new Date(`${due.date}T12:00:00`) : new Date();
    setDays(task.repeat_days?.length ? task.repeat_days : [task.repeat_weekday ?? d.getDay()]);
    setMonthDays(task.repeat_month_days?.length ? task.repeat_month_days : [task.repeat_day ?? d.getDate()]);
    setAssignedTo(task.assigned_to ?? 'none');
  }, [task]);

  if (!task) return null;
  const isOwner = task.owner_id === currentUserId;
  const repeats = repeat !== 'none';

  const toggle = (list: number[], v: number, set: (n: number[]) => void) => {
    const next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    if (next.length) set(next.sort((a, b) => a - b));
  };

  const save = () => {
    if (!title.trim()) return;
    let useDate = date;
    if (repeats) {
      const changedRule =
        repeat !== task.repeat ||
        interval !== (task.repeat_interval || 1) ||
        !sameSet(days, task.repeat_days ?? []) ||
        !sameSet(monthDays, task.repeat_month_days ?? []);
      const userPickedDate = date !== initialDate && !!date;
      if (!useDate || (changedRule && !userPickedDate)) {
        useDate = firstOccurrenceDate(repeat, days, monthDays);
      }
    }
    const due_at = useDate ? taskLocalToIso(useDate, time || '09:00') : null;

    onSave(task.id, {
      title: title.trim(),
      notes: notes.trim() || null,
      due_at,
      is_private: isOwner ? isPrivate : task.is_private,
      section_id: sectionId,
      repeat,
      repeat_interval: repeats ? interval : 1,
      repeat_days: repeat === 'weekly' ? days : null,
      repeat_month_days: repeat === 'monthly' ? monthDays : null,
      repeat_weekday: repeat === 'weekly' ? days[0] ?? null : null,
      repeat_day: repeat === 'monthly' ? monthDays[0] ?? null : null,
      assigned_to: assignedTo === 'none' ? null : assignedTo,
    });
    onClose();
  };

  const chip = (active: boolean) =>
    cn(
      'h-9 min-w-9 px-2 rounded-full border text-xs font-medium transition-colors',
      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'
    );

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit task</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task" className="text-base" />
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} />
          <div className="space-y-2">
            <Label>Reminder</Label>
            <div className="flex gap-2 items-center">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1" />
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date && !repeats} className="w-28" />
              {date && !repeats && (
                <Button variant="ghost" size="icon" onClick={() => { setDate(''); setTime(''); }} aria-label="Clear reminder">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {(date || repeats) && !time && <p className="text-xs text-muted-foreground">No time set — you'll be reminded at 9:00am.</p>}
          </div>

          <div className="space-y-3">
            <Label>Repeat</Label>
            <Select value={repeat} onValueChange={(v) => setRepeat(v as TaskRepeat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Never</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>

            {repeats && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span>Every</span>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={interval}
                    onChange={(e) => setIntervalValue(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-16 h-9"
                  />
                  <span>{UNIT_LABEL[repeat]}{interval > 1 ? 's' : ''}</span>
                </div>

                {repeat === 'weekly' && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">On these days</p>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_ORDER.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggle(days, d, setDays)}
                          className={chip(days.includes(d))}
                          aria-pressed={days.includes(d)}
                        >
                          {WEEKDAYS[d].slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {repeat === 'monthly' && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">On these dates</p>
                    <div className="grid grid-cols-7 gap-1.5">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggle(monthDays, d, setMonthDays)}
                          className={chip(monthDays.includes(d))}
                          aria-pressed={monthDays.includes(d)}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    {monthDays.some((d) => d > 28) && (
                      <p className="text-xs text-muted-foreground">Shorter months use their last day.</p>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">{repeatLabel(repeat, interval, days, monthDays)}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Assigned to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nobody</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: m.color }} />
                      {m.id === currentUserId ? `${m.name} (you)` : m.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Section</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between min-h-[44px]">
            <div>
              <Label>Only me</Label>
              <p className="text-xs text-muted-foreground">
                {isOwner ? 'Hide this task from everyone else' : 'Only the person who added this can change it'}
              </p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} disabled={!isOwner} />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="ghost" className="text-destructive" onClick={() => { onDelete(task.id); onClose(); }}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
