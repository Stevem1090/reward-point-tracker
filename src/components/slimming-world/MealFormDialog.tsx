import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { useSwFoods } from '@/hooks/useSwFoods';
import { useSwMeals } from '@/hooks/useSwMeals';
import { SwMealWithItems, HEALTHY_EXTRA_LABELS } from '@/types/slimmingWorld';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meal?: SwMealWithItems | null;
}

interface ItemDraft { food_id: string; quantity: number }

export function MealFormDialog({ open, onOpenChange, meal }: Props) {
  const { foods } = useSwFoods();
  const { saveMeal } = useSwMeals();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [pickFoodId, setPickFoodId] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      setName(meal?.name || '');
      setNotes(meal?.notes || '');
      setItems((meal?.items || []).map((i) => ({ food_id: i.food_id, quantity: Number(i.quantity || 1) })));
      setSearch('');
    }
  }, [open, meal]);

  const filteredFoods = useMemo(() => {
    const q = search.toLowerCase().trim();
    return foods.filter((f) => !q || f.name.toLowerCase().includes(q));
  }, [foods, search]);

  const totals = useMemo(() => {
    let swips = 0;
    const he: Record<string, number> = {};
    let speed = false;
    for (const it of items) {
      const f = foods.find((x) => x.id === it.food_id);
      if (!f) continue;
      swips += Number(f.swips || 0) * it.quantity;
      if (f.is_speed) speed = true;
      if (f.healthy_extra_type) {
        he[f.healthy_extra_type] = (he[f.healthy_extra_type] || 0) + Number(f.healthy_extra_amount || 0) * it.quantity;
      }
    }
    return { swips: Math.round(swips * 10) / 10, he, speed };
  }, [items, foods]);

  const addItem = (foodId: string) => {
    if (!foodId) return;
    setItems((prev) => [...prev, { food_id: foodId, quantity: 1 }]);
    setPickFoodId('');
    setSearch('');
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    await saveMeal.mutateAsync({ id: meal?.id, name: name.trim(), notes: notes.trim() || undefined, items });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meal ? 'Edit meal' : 'Create meal'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Breakfast bowl" />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Foods</Label>
            {items.length === 0 && <p className="text-sm text-muted-foreground">No foods added.</p>}
            {items.map((it, idx) => {
              const f = foods.find((x) => x.id === it.food_id);
              return (
                <div key={idx} className="flex items-center gap-2 border rounded-md p-2">
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="truncate">{f?.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{f?.swips ?? 0} swips · {f?.weight || ''}</div>
                  </div>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    inputMode="decimal"
                    className="w-20"
                    value={it.quantity}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setItems((prev) => prev.map((p, i) => i === idx ? { ...p, quantity: v } : p));
                    }}
                  />
                  <Button size="icon" variant="ghost" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}

            <div className="space-y-1">
              <Input placeholder="Search food to add..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {filteredFoods.slice(0, 8).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => addItem(f.id)}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                    >
                      <span className="truncate">{f.name}</span>
                      <Plus className="h-4 w-4 shrink-0" />
                    </button>
                  ))}
                  {filteredFoods.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>}
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-md p-3 bg-muted/40">
            <div className="text-sm font-medium mb-1">Totals</div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{totals.swips} Swips</Badge>
              {Object.entries(totals.he).map(([k, v]) => (
                <Badge key={k} className="bg-blue-100 text-blue-800 border-blue-200">
                  HE {HEALTHY_EXTRA_LABELS[k as keyof typeof HEALTHY_EXTRA_LABELS]} {Math.round(Number(v) * 10) / 10}
                </Badge>
              ))}
              {totals.speed && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Speed</Badge>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saveMeal.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
