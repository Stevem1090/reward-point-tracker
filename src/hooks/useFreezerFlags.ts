import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface FreezerFlag {
  id: string;
  meal_id: string;
  user_id: string;
  reminder_sent: boolean;
  created_at: string;
}

export function useFreezerFlags(mealPlanId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['freezerFlags', mealPlanId],
    queryFn: async () => {
      if (!mealPlanId) return [];

      // Get meal IDs for this plan first
      const { data: meals, error: mealsError } = await supabase
        .from('meals')
        .select('id')
        .eq('meal_plan_id', mealPlanId);

      if (mealsError) throw mealsError;
      if (!meals || meals.length === 0) return [];

      const mealIds = meals.map(m => m.id);

      const { data, error } = await supabase
        .from('freezer_flags')
        .select('*')
        .in('meal_id', mealIds);

      if (error) throw error;
      return (data || []) as FreezerFlag[];
    },
    enabled: !!mealPlanId,
  });

  // Build a Set of frozen meal IDs for quick lookup
  const frozenMealIds = new Set(flags.map(f => f.meal_id));

  const toggleFlag = useMutation({
    mutationFn: async (mealId: string) => {
      if (!user) throw new Error('Not authenticated');

      const existing = flags.find(f => f.meal_id === mealId);

      if (existing) {
        // Remove flag
        const { error } = await supabase
          .from('freezer_flags')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Add flag
        const { error } = await supabase
          .from('freezer_flags')
          .insert({ meal_id: mealId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freezerFlags', mealPlanId] });
    },
    onError: (error) => {
      console.error('Failed to toggle freezer flag:', error);
      toast.error('Failed to update freezer flag');
    },
  });

  return {
    frozenMealIds,
    flags,
    isLoading,
    toggleFlag,
  };
}
