import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Sparkles, Zap } from 'lucide-react';
import { useSwFoods } from '@/hooks/useSwFoods';
import { FoodFormDialog } from './FoodFormDialog';
import { SwFood, HEALTHY_EXTRA_LABELS } from '@/types/slimmingWorld';

export function FoodLibrary() {
  const { foods, isLoading, deleteFood } = useSwFoods();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<SwFood | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return foods;
    return foods.filter((f) => f.name.toLowerCase().includes(q));
  }, [foods, search]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="Search foods..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          No foods yet. Add your first one.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <Card key={f.id}>
              <CardContent className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{f.name}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {f.weight && <Badge variant="outline">{f.weight}</Badge>}
                    {f.is_free || f.swips === 0 ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        <Sparkles className="h-3 w-3 mr-1" /> Free
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{f.swips} Swips</Badge>
                    )}
                    {f.healthy_extra_type && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                        HE {HEALTHY_EXTRA_LABELS[f.healthy_extra_type]} {f.healthy_extra_amount}
                      </Badge>
                    )}
                    {f.is_speed && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                        <Zap className="h-3 w-3 mr-1" /> Speed
                      </Badge>
                    )}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { setEditing(f); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteFood.mutate(f.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FoodFormDialog open={open} onOpenChange={setOpen} food={editing} />
    </div>
  );
}
