import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useSwMeals } from '@/hooks/useSwMeals';
import { MealFormDialog } from './MealFormDialog';
import { SwMealWithItems, HEALTHY_EXTRA_LABELS } from '@/types/slimmingWorld';

function summarise(meal: SwMealWithItems) {
  let swips = 0;
  const he: Record<string, number> = {};
  let speed = false;
  for (const it of meal.items) {
    const f: any = it.food;
    if (!f) continue;
    const q = Number(it.quantity || 1);
    swips += Number(f.swips || 0) * q;
    if (f.is_speed) speed = true;
    if (f.healthy_extra_type) {
      he[f.healthy_extra_type] = (he[f.healthy_extra_type] || 0) + Number(f.healthy_extra_amount || 0) * q;
    }
  }
  return { swips: Math.round(swips * 10) / 10, he, speed };
}

export function MealLibrary() {
  const { meals, isLoading, deleteMeal } = useSwMeals();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SwMealWithItems | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Create meal
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : meals.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          No saved meals yet.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {meals.map((m) => {
            const t = summarise(m);
            return (
              <Card key={m.id}>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{m.name}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Badge variant="secondary">{t.swips} Swips</Badge>
                      {Object.entries(t.he).map(([k, v]) => (
                        <Badge key={k} className="bg-blue-100 text-blue-800 border-blue-200">
                          HE {HEALTHY_EXTRA_LABELS[k as keyof typeof HEALTHY_EXTRA_LABELS]} {Math.round(Number(v) * 10) / 10}
                        </Badge>
                      ))}
                      {t.speed && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Speed</Badge>}
                      <Badge variant="outline">{m.items.length} item{m.items.length === 1 ? '' : 's'}</Badge>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteMeal.mutate(m.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <MealFormDialog open={open} onOpenChange={setOpen} meal={editing} />
    </div>
  );
}
