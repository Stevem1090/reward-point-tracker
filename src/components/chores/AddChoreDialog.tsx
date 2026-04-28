import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { ChoreCategory, ChoreFrequency } from '@/types/chore';

interface AddChoreDialogProps {
  categories: ChoreCategory[];
  onAddChore: (data: { name: string; category_id: string; frequency: ChoreFrequency }) => Promise<void>;
  onAddCategory: (name: string) => Promise<ChoreCategory | null>;
}

export const AddChoreDialog: React.FC<AddChoreDialogProps> = ({ categories, onAddChore, onAddCategory }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [frequency, setFrequency] = useState<ChoreFrequency>('weekly');
  const [newCategory, setNewCategory] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const isCreatingCategory = creatingCategory || categories.length === 0;

  const handleSubmit = async () => {
    if (!name.trim()) return;
    let catId = categoryId;
    if (isCreatingCategory) {
      if (!newCategory.trim()) return;
      const cat = await onAddCategory(newCategory.trim());
      if (!cat) return;
      catId = cat.id;
    }
    if (!catId) return;
    await onAddChore({ name: name.trim(), category_id: catId, frequency });
    setName('');
    setNewCategory('');
    setCreatingCategory(false);
    setOpen(false);
  };

  const canSubmit =
    !!name.trim() && (isCreatingCategory ? !!newCategory.trim() : !!categoryId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-11">
          <Plus className="h-4 w-4 mr-1" /> Add chore
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a chore</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="chore-name">Name</Label>
            <Input
              id="chore-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hoover lounge"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            {!isCreatingCategory ? (
              <>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="link" size="sm" className="px-0 h-auto" onClick={() => setCreatingCategory(true)}>
                  + New category
                </Button>
              </>
            ) : (
              <>
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Downstairs"
                />
                {categories.length > 0 && (
                  <Button variant="link" size="sm" className="px-0 h-auto" onClick={() => setCreatingCategory(false)}>
                    ← Pick existing
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <RadioGroup value={frequency} onValueChange={(v) => setFrequency(v as ChoreFrequency)} className="grid grid-cols-3 gap-2">
              {(['weekly', 'monthly', 'adhoc'] as ChoreFrequency[]).map((f) => (
                <Label
                  key={f}
                  htmlFor={`freq-${f}`}
                  className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer capitalize text-sm"
                >
                  <RadioGroupItem value={f} id={`freq-${f}`} />
                  {f}
                </Label>
              ))}
            </RadioGroup>
          </div>

          <Button className="w-full h-11" onClick={handleSubmit} disabled={!canSubmit}>
            Add chore
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
