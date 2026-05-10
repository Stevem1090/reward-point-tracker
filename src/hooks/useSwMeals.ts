import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SwMealWithItems } from '@/types/slimmingWorld';

export function useSwMeals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const mealsQuery = useQuery({
    queryKey: ['sw_meals', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: meals, error } = await supabase
        .from('sw_meals')
        .select('*')
        .order('name');
      if (error) throw error;
      const ids = (meals || []).map((m: any) => m.id);
      if (ids.length === 0) return [] as SwMealWithItems[];
      const { data: items, error: ie } = await supabase
        .from('sw_meal_items')
        .select('*, food:sw_foods(*)')
        .in('meal_id', ids);
      if (ie) throw ie;
      return (meals || []).map((m: any) => ({
        ...m,
        items: (items || []).filter((i: any) => i.meal_id === m.id),
      })) as SwMealWithItems[];
    },
  });

  const saveMeal = useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      notes?: string;
      items: { food_id: string; quantity: number }[];
    }) => {
      if (!user) throw new Error('Not authenticated');
      let mealId = input.id;
      if (mealId) {
        const { error } = await supabase
          .from('sw_meals')
          .update({ name: input.name, notes: input.notes ?? null })
          .eq('id', mealId);
        if (error) throw error;
        await supabase.from('sw_meal_items').delete().eq('meal_id', mealId);
      } else {
        const { data, error } = await supabase
          .from('sw_meals')
          .insert({ user_id: user.id, name: input.name, notes: input.notes ?? null })
          .select()
          .single();
        if (error) throw error;
        mealId = data.id;
      }
      if (input.items.length > 0) {
        const rows = input.items.map((i) => ({
          meal_id: mealId!,
          food_id: i.food_id,
          quantity: Number(i.quantity ?? 1),
        }));
        const { error } = await supabase.from('sw_meal_items').insert(rows);
        if (error) throw error;
      }
      return mealId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sw_meals'] });
      toast({ title: 'Meal saved' });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sw_meals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sw_meals'] });
      toast({ title: 'Meal deleted' });
    },
  });

  return { meals: mealsQuery.data || [], isLoading: mealsQuery.isLoading, saveMeal, deleteMeal };
}
