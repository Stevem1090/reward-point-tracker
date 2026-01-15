import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MealPlan, Meal, MealPlanWithMeals, DayOfWeek, MealStatus, MealPlanStatus, RecipeSourceType, Ingredient } from '@/types/meal';
import { toast } from 'sonner';
import { getWeekStartDate } from '@/utils/getWeekBounds';

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

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
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('meal_plans')
        .insert([{ week_start_date: weekStartDate, user_id: userId }])
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

  const updateMealUrl = useMutation({
    mutationFn: async ({ mealId, recipeUrl, mealName }: { mealId: string; recipeUrl: string; mealName: string }) => {
      // If URL is provided, extract recipe data to get name, description, and cook time
      if (recipeUrl) {
        try {
          const { data: extractData, error: extractError } = await supabase.functions
            .invoke('extract-recipe-from-url', {
              body: { url: recipeUrl, mealName }
            });
          
          if (!extractError && extractData?.recipe) {
            const recipe = extractData.recipe;
            // Update meal with extracted data
            const { error } = await supabase
              .from('meals')
              .update({ 
                recipe_url: recipeUrl,
                meal_name: recipe.name || mealName,
                description: recipe.description || null,
                estimated_cook_minutes: recipe.estimated_cook_minutes || null,
              })
              .eq('id', mealId);
            if (error) throw error;
            return { extracted: true };
          }
        } catch (e) {
          console.warn('Could not extract recipe, saving URL only:', e);
        }
      }
      
      // Fallback: just update the URL
      const { error } = await supabase
        .from('meals')
        .update({ recipe_url: recipeUrl })
        .eq('id', mealId);
      if (error) throw error;
      return { extracted: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
      toast.success(result?.extracted ? 'Recipe details extracted!' : 'Recipe URL updated');
    },
    onError: () => toast.error('Failed to update recipe URL')
  });

  const replaceMeal = useMutation({
    mutationFn: async ({ 
      mealId, 
      mealName, 
      description, 
      recipeUrl, 
      servings, 
      estimatedCookMinutes,
      recipeId 
    }: { 
      mealId: string; 
      mealName: string; 
      description?: string; 
      recipeUrl?: string; 
      servings: number;
      estimatedCookMinutes?: number;
      recipeId?: string;
    }) => {
      const { error } = await supabase
        .from('meals')
        .update({ 
          meal_name: mealName,
          description: description || null,
          recipe_url: recipeUrl || null,
          servings,
          estimated_cook_minutes: estimatedCookMinutes || null,
          recipe_id: recipeId || null,
          source_type: recipeId ? 'user_library' : 'user_custom',
          status: 'pending' // Reset to pending for re-approval
        })
        .eq('id', mealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
      toast.success('Meal replaced');
    },
    onError: () => toast.error('Failed to replace meal')
  });

  const addMealToDay = useMutation({
    mutationFn: async ({ 
      mealPlanId,
      dayOfWeek,
      mealName, 
      description, 
      recipeUrl, 
      servings, 
      estimatedCookMinutes,
      recipeId 
    }: { 
      mealPlanId: string;
      dayOfWeek: DayOfWeek;
      mealName: string; 
      description?: string; 
      recipeUrl?: string; 
      servings: number;
      estimatedCookMinutes?: number;
      recipeId?: string;
    }) => {
      const { error } = await supabase
        .from('meals')
        .insert([{ 
          meal_plan_id: mealPlanId,
          day_of_week: dayOfWeek,
          meal_name: mealName,
          description: description || null,
          recipe_url: recipeUrl || null,
          servings,
          estimated_cook_minutes: estimatedCookMinutes || null,
          recipe_id: recipeId || null,
          source_type: recipeId ? 'user_library' : 'user_custom',
          status: 'pending'
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
      toast.success('Meal added');
    },
    onError: () => toast.error('Failed to add meal')
  });

  const saveAIRecipesToLibrary = async (meals: Array<{
    meal_name: string;
    description: string | null;
    recipe_url: string | null;
    source_type: string;
    recipe_id: string | null;
    estimated_cook_minutes: number | null;
    recipe_card?: {
      ingredients: Ingredient[];
      steps: string[];
      base_servings: number;
    };
  }>) => {
    const userId = await getCurrentUserId();
    
    // Filter to AI-generated meals with recipe cards that aren't already from library
    const aiMealsToSave = meals.filter(m => 
      m.source_type === 'ai_generated' && 
      m.recipe_card && 
      !m.recipe_id
    );

    let savedCount = 0;
    for (const meal of aiMealsToSave) {
      // Cast ingredients to JSON-compatible format for Supabase
      const ingredientsJson = meal.recipe_card!.ingredients.map(ing => ({
        quantity: ing.quantity,
        unit: ing.unit,
        name: ing.name,
      }));
      
      const { error } = await supabase.from('recipes').insert([{
        user_id: userId,
        name: meal.meal_name,
        description: meal.description,
        source_type: (meal.recipe_url ? 'website' : 'cookbook') as RecipeSourceType,
        recipe_url: meal.recipe_url,
        ingredients: ingredientsJson,
        steps: meal.recipe_card!.steps,
        servings: meal.recipe_card!.base_servings,
        estimated_cook_minutes: meal.estimated_cook_minutes,
      }]);
      
      if (error) {
        console.error('Failed to save recipe:', error);
      } else {
        savedCount++;
      }
    }
    
    return savedCount;
  };

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
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
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
    updateMealUrl,
    replaceMeal,
    addMealToDay,
    approveMealPlan,
    deleteMealPlan,
    saveAIRecipesToLibrary
  };
}
