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
import { taskLocalParts, taskLocalToIso } from '@/lib/tasks/dateTime';

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

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes ?? '');
    const due = task.due_at ? taskLocalParts(task.due_at) : null;
    setDate(due?.date ?? '');
    setTime(due?.time ?? '');
    setIsPrivate(task.is_private);
    setSectionId(task.section_id);
  }, [task]);

  if (!task) return null;
  const isOwner = task.owner_id === currentUserId;

  const save = () => {
    if (!title.trim()) return;
    const due_at = date ? taskLocalToIso(date, time || '09:00') : null;
    onSave(task.id, {
      title: title.trim(),
      notes: notes.trim() || null,
      due_at,
      is_private: isOwner ? isPrivate : task.is_private,
      section_id: sectionId,
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
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1" />
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} className="w-28" />
              {date && (
                <Button variant="ghost" size="icon" onClick={() => { setDate(''); setTime(''); }} aria-label="Clear reminder">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {date && !time && <p className="text-xs text-muted-foreground">No time set — you'll be reminded at 9:00am.</p>}
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
