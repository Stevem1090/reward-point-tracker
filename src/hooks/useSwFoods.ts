import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SwFood } from '@/types/slimmingWorld';

export function useSwFoods() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const foodsQuery = useQuery({
    queryKey: ['sw_foods', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sw_foods')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as SwFood[];
    },
  });

  const upsertFood = useMutation({
    mutationFn: async (food: Partial<SwFood> & { name: string }) => {
      if (!user) throw new Error('Not authenticated');
      const payload = {
        user_id: user.id,
        name: food.name,
        weight: food.weight ?? null,
        swips: Number(food.swips ?? 0),
        is_free: !!food.is_free,
        healthy_extra_type: food.healthy_extra_type ?? null,
        healthy_extra_amount: Number(food.healthy_extra_amount ?? 0),
        is_speed: !!food.is_speed,
      };
      if (food.id) {
        const { data, error } = await supabase
          .from('sw_foods')
          .update(payload)
          .eq('id', food.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('sw_foods')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sw_foods'] });
      toast({ title: 'Food saved' });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const deleteFood = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sw_foods').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sw_foods'] });
      toast({ title: 'Food deleted' });
    },
  });

  return { foods: foodsQuery.data || [], isLoading: foodsQuery.isLoading, upsertFood, deleteFood };
}
