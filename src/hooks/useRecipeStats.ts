import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RecipeStats {
  recipeId: string;
  avgRating: number | null;
  ratingCount: number;
  timesEaten: number;
  lastEatenDate: string | null;
}

/**
 * Aggregates rating + usage history for a set of recipe IDs in a single query.
 * Stats follow the recipe across weeks, not just the single weekly meal slot.
 */
export function useRecipesStats(recipeIds: string[]) {
  return useQuery({
    queryKey: ['recipeStats', [...recipeIds].sort()],
    enabled: recipeIds.length > 0,
    queryFn: async (): Promise<Map<string, RecipeStats>> => {
      const map = new Map<string, RecipeStats>();
      if (recipeIds.length === 0) return map;

      // 1. Ratings keyed on recipe_id
      const { data: ratings } = await supabase
        .from('meal_ratings')
        .select('rating, recipe_id')
        .in('recipe_id', recipeIds);

      // 2. Times eaten + last eaten via meals -> meal_plans.week_start_date
      const { data: mealsRaw } = await supabase
        .from('meals')
        .select('recipe_id, status, meal_plan_id')
        .in('recipe_id', recipeIds);

      const planIds = Array.from(
        new Set((mealsRaw || []).map((m: any) => m.meal_plan_id).filter(Boolean))
      );
      let planDateMap = new Map<string, string>();
      if (planIds.length > 0) {
        const { data: plans } = await supabase
          .from('meal_plans')
          .select('id, week_start_date, status')
          .in('id', planIds);
        (plans || []).forEach((p: any) => {
          if (p.status === 'approved') planDateMap.set(p.id, p.week_start_date);
        });
      }

      for (const id of recipeIds) {
        const rs = (ratings || []).filter((r: any) => r.recipe_id === id);
        const sum = rs.reduce((acc: number, r: any) => acc + (r.rating || 0), 0);
        const meals = (mealsRaw || []).filter(
          (m: any) =>
            m.recipe_id === id &&
            (m.status === 'approved' || m.status === 'pending') &&
            planDateMap.has(m.meal_plan_id)
        );
        const dates = meals
          .map((m: any) => planDateMap.get(m.meal_plan_id))
          .filter(Boolean) as string[];
        const lastEaten = dates.length
          ? dates.sort().reverse()[0]
          : null;

        map.set(id, {
          recipeId: id,
          avgRating: rs.length ? sum / rs.length : null,
          ratingCount: rs.length,
          timesEaten: meals.length,
          lastEatenDate: lastEaten,
        });
      }
      return map;
    },
  });
}

export function useRecipeStats(recipeId: string | null | undefined) {
  return useQuery({
    queryKey: ['recipeStats', 'single', recipeId],
    enabled: !!recipeId,
    queryFn: async (): Promise<RecipeStats | null> => {
      if (!recipeId) return null;
      const { data: ratings } = await supabase
        .from('meal_ratings')
        .select('rating')
        .eq('recipe_id', recipeId);
      const { data: meals } = await supabase
        .from('meals')
        .select('meal_plan_id, status')
        .eq('recipe_id', recipeId);

      const planIds = Array.from(
        new Set((meals || []).map((m: any) => m.meal_plan_id).filter(Boolean))
      );
      let dates: string[] = [];
      if (planIds.length) {
        const { data: plans } = await supabase
          .from('meal_plans')
          .select('id, week_start_date, status')
          .in('id', planIds)
          .eq('status', 'approved');
        const dateMap = new Map((plans || []).map((p: any) => [p.id, p.week_start_date]));
        dates = (meals || [])
          .map((m: any) => dateMap.get(m.meal_plan_id))
          .filter(Boolean) as string[];
      }
      const sum = (ratings || []).reduce((a: number, r: any) => a + (r.rating || 0), 0);
      return {
        recipeId,
        avgRating: ratings?.length ? sum / ratings.length : null,
        ratingCount: ratings?.length || 0,
        timesEaten: dates.length,
        lastEatenDate: dates.length ? dates.sort().reverse()[0] : null,
      };
    },
  });
}
