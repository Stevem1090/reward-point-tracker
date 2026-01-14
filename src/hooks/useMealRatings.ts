import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MealRating } from '@/types/meal';
import { toast } from 'sonner';

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

export function useMealRatings() {
  const queryClient = useQueryClient();

  const useRatingForMeal = (mealId: string | null) => {
    return useQuery({
      queryKey: ['mealRating', mealId],
      queryFn: async (): Promise<MealRating | null> => {
        if (!mealId) return null;
        const { data, error } = await supabase
          .from('meal_ratings')
          .select('*')
          .eq('meal_id', mealId)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      enabled: !!mealId
    });
  };

  const upsertRating = useMutation({
    mutationFn: async ({ mealId, rating, notes }: { mealId: string; rating: number; notes?: string }) => {
      const userId = await getCurrentUserId();
      
      const { data: existing } = await supabase
        .from('meal_ratings')
        .select('id')
        .eq('meal_id', mealId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from('meal_ratings').update({ rating, notes }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meal_ratings').insert([{ meal_id: mealId, rating, notes, user_id: userId }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealRating'] });
      toast.success('Rating saved!');
    },
    onError: () => toast.error('Failed to save rating')
  });

  return { useRatingForMeal, upsertRating };
}
