import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { SHOPPING_CATEGORIES, ShoppingListItem } from '@/types/meal';

export interface ShoppingItemDraft {
  name: string;
  quantity: string;
  unit: string;
  category: string;
}

interface ShoppingItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ShoppingListItem | null;
  onSave: (draft: ShoppingItemDraft) => void;
  onDelete?: () => void;
  isSaving?: boolean;
}

const EMPTY: ShoppingItemDraft = { name: '', quantity: '', unit: '', category: 'Other' };

export function ShoppingItemDialog({
  open,
  onOpenChange,
  item,
  onSave,
  onDelete,
  isSaving,
}: ShoppingItemDialogProps) {
  const [draft, setDraft] = useState<ShoppingItemDraft>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setDraft(
      item
        ? {
            name: item.name,
            quantity: item.quantity ?? '',
            unit: item.unit ?? '',
            category: item.category || 'Other',
          }
        : EMPTY
    );
  }, [open, item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onSave({ ...draft, name: draft.name.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit item' : 'Add item'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Chicken breast"
              className="min-h-[44px]"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-qty">Quantity</Label>
              <Input
                id="item-qty"
                value={draft.quantity}
                onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                placeholder="500"
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-unit">Unit</Label>
              <Input
                id="item-unit"
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                placeholder="g"
                className="min-h-[44px]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={draft.category}
              onValueChange={(value) => setDraft({ ...draft, category: value })}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHOPPING_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {item && onDelete ? (
              <Button
                type="button"
                variant="outline"
                onClick={onDelete}
                className="gap-2 text-destructive hover:text-destructive min-h-[44px]"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              disabled={!draft.name.trim() || isSaving}
              className="min-h-[44px]"
            >
              {item ? 'Save changes' : 'Add item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
