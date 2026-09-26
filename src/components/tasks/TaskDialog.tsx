import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, X } from 'lucide-react';
import type { Task, TaskSection } from '@/hooks/useTasks';
import { taskLocalParts, taskLocalToIso, firstOccurrenceDate, WEEKDAYS, type TaskRepeat } from '@/lib/tasks/dateTime';

interface Props {
  task: Task | null;
  sections: TaskSection[];
  currentUserId?: string;
  onClose: () => void;
  onSave: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export const TaskDialog: React.FC<Props> = ({ task, sections, currentUserId, onClose, onSave, onDelete }) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [sectionId, setSectionId] = useState('');
  const [repeat, setRepeat] = useState<TaskRepeat>('none');
  const [weekday, setWeekday] = useState(1);
  const [monthDay, setMonthDay] = useState(1);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes ?? '');
    const due = task.due_at ? taskLocalParts(task.due_at) : null;
    setDate(due?.date ?? '');
    setTime(due?.time ?? '');
    setIsPrivate(task.is_private);
    setSectionId(task.section_id);
    setRepeat(task.repeat ?? 'none');
    const d = due ? new Date(`${due.date}T12:00:00`) : new Date();
    setWeekday(task.repeat_weekday ?? d.getDay());
    setMonthDay(task.repeat_day ?? d.getDate());
  }, [task]);

  if (!task) return null;
  const isOwner = task.owner_id === currentUserId;

  const save = () => {
    if (!title.trim()) return;
    let useDate = date;
    if (repeat !== 'none') {
      const changedRule = repeat !== task.repeat || weekday !== task.repeat_weekday || monthDay !== task.repeat_day;
      if (!useDate || changedRule) useDate = firstOccurrenceDate(repeat, weekday, monthDay);
    }
    const due_at = useDate ? taskLocalToIso(useDate, time || '09:00') : null;
    onSave(task.id, {
      title: title.trim(),
      notes: notes.trim() || null,
      due_at,
      is_private: isOwner ? isPrivate : task.is_private,
      section_id: sectionId,
      repeat,
      repeat_weekday: repeat === 'weekly' ? weekday : null,
      repeat_day: repeat === 'monthly' ? monthDay : null,
    });
    onClose();
  };

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit task</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task" className="text-base" />
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} />
          <div className="space-y-2">
            <Label>Reminder</Label>
            <div className="flex gap-2 items-center">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1" disabled={repeat !== 'none'} />
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date && repeat === 'none'} className="w-28" />
              {date && repeat === 'none' && (
                <Button variant="ghost" size="icon" onClick={() => { setDate(''); setTime(''); }} aria-label="Clear reminder">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {(date || repeat !== 'none') && !time && <p className="text-xs text-muted-foreground">No time set — you'll be reminded at 9:00am.</p>}
          </div>
          <div className="space-y-2">
            <Label>Repeat</Label>
            <div className="flex gap-2">
              <Select value={repeat} onValueChange={(v) => setRepeat(v as TaskRepeat)}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Never</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              {repeat === 'weekly' && (
                <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => <SelectItem key={d} value={String(d)}>{WEEKDAYS[d]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {repeat === 'monthly' && (
                <Select value={String(monthDay)} onValueChange={(v) => setMonthDay(Number(v))}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            {repeat === 'monthly' && monthDay > 28 && <p className="text-xs text-muted-foreground">Shorter months use their last day.</p>}
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
