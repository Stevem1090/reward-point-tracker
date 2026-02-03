import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DayOfWeek, MealSourceType } from '@/types/meal';
import { toast } from 'sonner';

interface RejectedMealInfo {
  name: string;
  reason: string;
}

interface GenerateMealPlanParams {
  mealPlanId: string;
  weekStartDate: string;
  preferences?: string;
  excludeMeals?: string[];
  rejectedMeals?: RejectedMealInfo[];
  daysToRegenerate?: DayOfWeek[];
}

interface GeneratedMeal {
  day_of_week: DayOfWeek;
  meal_name: string;
  description: string;
  suggested_url: string;
  url_confidence: 'high' | 'medium' | 'low';
  estimated_cook_minutes: number;
  servings: number;
  is_spicy: boolean;
  kid_friendly_notes?: string;
}

export function useAIMealGeneration() {
  const queryClient = useQueryClient();

  const generateMealPlan = useMutation({
    mutationFn: async ({ mealPlanId, weekStartDate, preferences, excludeMeals, rejectedMeals, daysToRegenerate }: GenerateMealPlanParams) => {
      // Get auth token for edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call the edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-meal-plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ preferences, excludeMeals, rejectedMeals, daysToRegenerate }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        }
        if (response.status === 402) {
          throw new Error('AI credits exhausted. Please add funds to continue.');
        }
        throw new Error(errorData.error || 'Failed to generate meal plan');
      }

      const { meals }: { meals: GeneratedMeal[] } = await response.json();

      // Only delete meals for the days being regenerated (or all if regenerating whole plan)
      if (daysToRegenerate && daysToRegenerate.length > 0) {
        // Delete only meals for specific days
        for (const day of daysToRegenerate) {
          await supabase
            .from('meals')
            .delete()
            .eq('meal_plan_id', mealPlanId)
            .eq('day_of_week', day);
        }
      } else {
        // Full regeneration - delete all meals
        await supabase
          .from('meals')
          .delete()
          .eq('meal_plan_id', mealPlanId);
      }

      // Get current max sort_order
      const { data: existingMeals } = await supabase
        .from('meals')
        .select('sort_order')
        .eq('meal_plan_id', mealPlanId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const startSortOrder = (existingMeals?.[0]?.sort_order ?? -1) + 1;

      // Insert the new meals
      const mealsToInsert = meals.map((meal, index) => ({
        meal_plan_id: mealPlanId,
        day_of_week: meal.day_of_week,
        meal_name: meal.meal_name,
        description: meal.description,
        recipe_url: meal.suggested_url,
        source_type: 'ai_generated' as MealSourceType,
        estimated_cook_minutes: meal.estimated_cook_minutes,
        servings: meal.servings,
        status: 'pending' as const,
        sort_order: startSortOrder + index,
      }));

      const { error: insertError } = await supabase
        .from('meals')
        .insert(mealsToInsert);

      if (insertError) throw insertError;

      return meals;
    },
    onSuccess: (_, { weekStartDate, daysToRegenerate }) => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan', weekStartDate] });
      const message = daysToRegenerate?.length 
        ? `Regenerated ${daysToRegenerate.length} meal${daysToRegenerate.length > 1 ? 's' : ''}!`
        : 'Meal plan generated!';
      toast.success(message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return { generateMealPlan };
}
