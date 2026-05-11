import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSwFoods } from '@/hooks/useSwFoods';
import { useSwMeals } from '@/hooks/useSwMeals';
import { useSwLog } from '@/hooks/useSwLog';
import { useRecipes } from '@/hooks/useRecipes';
import { useMealPlans } from '@/hooks/useMealPlans';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  logDate: string;
  weekStart: Date;
}

export function AddEntryDialog({ open, onOpenChange, logDate, weekStart }: Props) {
  const { foods } = useSwFoods();
  const { meals } = useSwMeals();
  const { recipes } = useRecipes();
  const { addEntry } = useSwLog(weekStart);
  const { useMealPlanForWeek } = useMealPlans();
  const { data: weekPlan } = useMealPlanForWeek(format(weekStart, 'yyyy-MM-dd'));
  const [tab, setTab] = useState('plan');
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState('1');

  const recipesWithSw = useMemo(
    () => (recipes || []).filter((r: any) => r.sw_swips != null || r.sw_healthy_extra_type),
    [recipes]
  );

  // Build plan items from this week's meals — joined with recipe SW info when available
  const planItems = useMemo(() => {
    const planMeals = weekPlan?.meals || [];
    const recipeMap = new Map<string, any>((recipes || []).map((r: any) => [r.id, r]));
    return planMeals
      .filter((m: any) => m.meal_name)
      .map((m: any) => {
        const r = m.recipe_id ? recipeMap.get(m.recipe_id) : null;
        return {
          id: m.recipe_id || m.id,
          name: m.meal_name,
          day: m.day_of_week,
          sw_swips: r?.sw_swips ?? null,
          sw_healthy_extra_type: r?.sw_healthy_extra_type ?? null,
          sw_healthy_extra_amount: r?.sw_healthy_extra_amount ?? null,
          sw_is_speed: r?.sw_is_speed ?? null,
          hasSw: !!r && (r.sw_swips != null || r.sw_healthy_extra_type),
        };
      });
  }, [weekPlan, recipes]);

  const filteredFoods = useMemo(() => {
    const q = search.toLowerCase().trim();
    return foods.filter((f) => !q || f.name.toLowerCase().includes(q));
  }, [foods, search]);

  const filteredMeals = useMemo(() => {
    const q = search.toLowerCase().trim();
    return meals.filter((m) => !q || m.name.toLowerCase().includes(q));
  }, [meals, search]);

  const filteredRecipes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return recipesWithSw.filter((r: any) => !q || r.name.toLowerCase().includes(q));
  }, [recipesWithSw, search]);

  const filteredPlan = useMemo(() => {
    const q = search.toLowerCase().trim();
    return planItems.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [planItems, search]);

  const handleAdd = async (kind: 'food' | 'meal' | 'recipe', payload: any) => {
    const qty = Number(quantity) || 1;
    if (kind === 'food') await addEntry.mutateAsync({ log_date: logDate, entry_type: 'food', food: payload, quantity: qty });
    if (kind === 'meal') await addEntry.mutateAsync({ log_date: logDate, entry_type: 'meal', meal: payload, quantity: qty });
    if (kind === 'recipe') await addEntry.mutateAsync({ log_date: logDate, entry_type: 'recipe', recipe: payload, quantity: qty });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to log</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">Search</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." />
          </div>
          <div className="w-24">
            <Label className="text-xs">Qty</Label>
            <Input type="number" step="0.1" min="0.1" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="plan">This week</TabsTrigger>
            <TabsTrigger value="recipe">Library</TabsTrigger>
            <TabsTrigger value="food">Foods</TabsTrigger>
            <TabsTrigger value="meal">Meals</TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="max-h-72 overflow-y-auto space-y-1">
            {filteredPlan.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No meals planned this week.</p>}
            {filteredPlan.map((p) => (
              <button
                key={p.id + p.day}
                type="button"
                disabled={!p.hasSw}
                onClick={() => p.hasSw && handleAdd('recipe', p)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center justify-between text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="min-w-0">
                  <div className="truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.day} · {p.hasSw ? `${p.sw_swips ?? 0} swips${p.sw_healthy_extra_type ? ` · HE ${p.sw_healthy_extra_type}` : ''}` : 'No SW info on recipe'}
                  </div>
                </div>
                <Plus className="h-4 w-4 shrink-0" />
              </button>
            ))}
          </TabsContent>

          <TabsContent value="food" className="max-h-72 overflow-y-auto space-y-1">
            {filteredFoods.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No foods.</p>}
            {filteredFoods.map((f) => (
              <button key={f.id} type="button" onClick={() => handleAdd('food', f)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <div className="truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{f.swips} swips{f.healthy_extra_type ? ` · HE ${f.healthy_extra_type}` : ''}</div>
                </div>
                <Plus className="h-4 w-4 shrink-0" />
              </button>
            ))}
          </TabsContent>

          <TabsContent value="meal" className="max-h-72 overflow-y-auto space-y-1">
            {filteredMeals.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No meals.</p>}
            {filteredMeals.map((m) => (
              <button key={m.id} type="button" onClick={() => handleAdd('meal', m)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center justify-between text-sm">
                <span className="truncate">{m.name}</span>
                <Plus className="h-4 w-4 shrink-0" />
              </button>
            ))}
          </TabsContent>

          <TabsContent value="recipe" className="max-h-72 overflow-y-auto space-y-1">
            {filteredRecipes.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No recipes with SW info yet.</p>}
            {filteredRecipes.map((r: any) => (
              <button key={r.id} type="button" onClick={() => handleAdd('recipe', r)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <div className="truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.sw_swips ?? 0} swips{r.sw_healthy_extra_type ? ` · HE ${r.sw_healthy_extra_type}` : ''}</div>
                </div>
                <Plus className="h-4 w-4 shrink-0" />
              </button>
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
