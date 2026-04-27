import { supabase } from '@/integrations/supabase/client';
import { Ingredient } from '@/types/meal';

interface EstimateParams {
  recipeCardId: string;
  ingredients: Ingredient[];
  servings: number;
  mealName: string;
}

/**
 * Fire-and-forget calorie estimation for a recipe card.
 * Updates the recipe_cards row server-side. Failures are non-fatal.
 */
export async function estimateCaloriesForRecipeCard({
  recipeCardId,
  ingredients,
  servings,
  mealName,
}: EstimateParams): Promise<number | null> {
  if (!ingredients || ingredients.length === 0) return null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

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

    if (!response.ok) {
      console.warn('Calorie estimation failed:', response.status);
      return null;
    }

    const { calories_per_serving } = await response.json();
    return calories_per_serving || null;
  } catch (err) {
    console.warn('Calorie estimation error:', err);
    return null;
  }
}
