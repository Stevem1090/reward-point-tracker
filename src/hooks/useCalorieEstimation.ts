import { supabase } from '@/integrations/supabase/client';
import { Ingredient } from '@/types/meal';

interface EstimateParams {
  recipeCardId: string;
  ingredients: Ingredient[];
  servings: number;
  mealName: string;
}

export type CalorieEstimateResult =
  | { status: 'ok'; calories: number }
  | { status: 'rate_limited' }
  | { status: 'credits_exhausted' }
  | { status: 'no_ingredients' }
  | { status: 'unauthenticated' }
  | { status: 'error'; message?: string };

/**
 * Calorie estimation for a recipe card. Persists server-side on success.
 * Returns a structured result so the UI can show appropriate feedback.
 */
export async function estimateCaloriesForRecipeCard({
  recipeCardId,
  ingredients,
  servings,
  mealName,
}: EstimateParams): Promise<CalorieEstimateResult> {
  if (!ingredients || ingredients.length === 0) {
    return { status: 'no_ingredients' };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { status: 'unauthenticated' };

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-calories`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ingredients,
          servings,
          mealName,
          recipeCardId,
        }),
      }
    );

    if (response.status === 429) return { status: 'rate_limited' };
    if (response.status === 402) return { status: 'credits_exhausted' };

    if (!response.ok) {
      console.warn('Calorie estimation failed:', response.status);
      return { status: 'error', message: `HTTP ${response.status}` };
    }

    const { calories_per_serving } = await response.json();
    if (typeof calories_per_serving === 'number' && calories_per_serving > 0) {
      return { status: 'ok', calories: calories_per_serving };
    }
    return { status: 'error', message: 'No calorie value returned' };
  } catch (err) {
    console.warn('Calorie estimation error:', err);
    return { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }
}
