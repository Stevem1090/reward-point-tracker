import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MealPlan, Meal, MealPlanWithMeals, DayOfWeek, MealStatus, MealPlanStatus } from '@/types/meal';
import { toast } from 'sonner';
import { getWeekStartDate } from '@/utils/getWeekBounds';

export function useMealPlans() {
  const queryClient = useQueryClient();

  const useMealPlanForWeek = (weekStartDate: string) => {
    return useQuery({
      queryKey: ['mealPlan', weekStartDate],
      queryFn: async (): Promise<MealPlanWithMeals | null> => {
        const { data: mealPlan, error: planError } = await supabase
          .from('meal_plans')
          .select('*')
          .eq('week_start_date', weekStartDate)
          .maybeSingle();

        if (planError) throw planError;
        if (!mealPlan) return null;

        const { data: meals, error: mealsError } = await supabase
          .from('meals')
          .select(`*, recipe_card:recipe_cards(*)`)
          .eq('meal_plan_id', mealPlan.id)
          .order('sort_order');

        if (mealsError) throw mealsError;

        return {
          ...mealPlan,
          status: mealPlan.status as MealPlanStatus,
          meals: (meals || []).map(meal => ({
            ...meal,
            day_of_week: meal.day_of_week as DayOfWeek,
            status: meal.status as MealStatus,
            source_type: meal.source_type as Meal['source_type'],
            recipe_card: Array.isArray(meal.recipe_card) ? meal.recipe_card[0] : meal.recipe_card
          }))
        } as MealPlanWithMeals;
      }
    });
  };

  const createMealPlan = useMutation({
    mutationFn: async (weekStartDate: string): Promise<MealPlan> => {
      const { data, error } = await supabase
        .from('meal_plans')
        .insert([{ week_start_date: weekStartDate }])
        .select()
        .single();

      if (error) throw error;
      return { ...data, status: data.status as MealPlanStatus };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan', data.week_start_date] });
      toast.success('Meal plan created');
    },
    onError: () => toast.error('Failed to create meal plan')
  });

  const updateMealStatus = useMutation({
    mutationFn: async ({ mealId, status }: { mealId: string; status: MealStatus }) => {
      const { error } = await supabase
        .from('meals')
        .update({ status })
        .eq('id', mealId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mealPlan'] }),
    onError: () => toast.error('Failed to update meal')
  });

  const updateMealServings = useMutation({
    mutationFn: async ({ mealId, servings }: { mealId: string; servings: number }) => {
      const { error } = await supabase
        .from('meals')
        .update({ servings })
        .eq('id', mealId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mealPlan'] }),
    onError: () => toast.error('Failed to update servings')
  });

  const approveMealPlan = useMutation({
    mutationFn: async (mealPlanId: string) => {
      const { error } = await supabase
        .from('meal_plans')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', mealPlanId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
      toast.success('Meal plan approved!');
    },
    onError: () => toast.error('Failed to approve meal plan')
  });

  const deleteMealPlan = useMutation({
    mutationFn: async (mealPlanId: string) => {
      const { error } = await supabase.from('meal_plans').delete().eq('id', mealPlanId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
      toast.success('Meal plan deleted');
    },
    onError: () => toast.error('Failed to delete meal plan')
  });

  const usePreviousMealPlans = () => {
    const currentWeekStart = getWeekStartDate();
    return useQuery({
      queryKey: ['previousMealPlans'],
      queryFn: async (): Promise<MealPlan[]> => {
        const { data, error } = await supabase
          .from('meal_plans')
          .select('*')
          .lt('week_start_date', currentWeekStart)
          .order('week_start_date', { ascending: false })
          .limit(12);

        if (error) throw error;
        return (data || []).map(p => ({ ...p, status: p.status as MealPlanStatus }));
      }
    });
  };

  return {
    useMealPlanForWeek,
    usePreviousMealPlans,
    createMealPlan,
    updateMealStatus,
    updateMealServings,
    approveMealPlan,
    deleteMealPlan
  };
}
