import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Ingredient } from '@/types/meal';
import { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';

interface ExtractedRecipe {
  name: string;
  description: string;
  servings: number;
  estimated_cook_minutes?: number;
  ingredients: Ingredient[];
  steps: string[];
  image_url?: string;
}

interface ExtractFromUrlParams {
  mealId: string;
  url: string;
  mealName: string;
}

interface ProcessCookbookParams {
  recipeText: string;
  cookbookTitle?: string;
  recipeName?: string;
}

export function useRecipeExtraction() {
  const queryClient = useQueryClient();

  const extractFromUrl = useMutation({
    mutationFn: async ({ mealId, url, mealName }: ExtractFromUrlParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-recipe-from-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ url, mealName }),
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
        throw new Error(errorData.error || 'Failed to extract recipe');
      }

      const responseData = await response.json();

      // Handle extraction failure - create a placeholder recipe card with empty data
      if (responseData.extraction_failed) {
        // Create/update the recipe card with failed state (empty ingredients/steps)
        const { data: existing } = await supabase
          .from('recipe_cards')
          .select('id')
          .eq('meal_id', mealId)
          .maybeSingle();

        const failedCardData = {
          meal_id: mealId,
          meal_name: mealName,
          image_url: null,
          ingredients: [] as unknown as Json,
          steps: [] as unknown as Json,
          base_servings: 4,
        };

        if (existing) {
          const { error: updateError } = await supabase
            .from('recipe_cards')
            .update(failedCardData)
            .eq('id', existing.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('recipe_cards')
            .insert([failedCardData]);
          if (insertError) throw insertError;
        }

        // Return a marker so the UI knows extraction failed
        return { extraction_failed: true, sourceUrl: responseData.sourceUrl };
      }

      const { recipe }: { recipe: ExtractedRecipe } = responseData;

      // Create the recipe card - first try to get existing
      const { data: existing } = await supabase
        .from('recipe_cards')
        .select('id')
        .eq('meal_id', mealId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('recipe_cards')
          .update({
            meal_name: recipe.name,
            image_url: recipe.image_url || null,
            ingredients: recipe.ingredients as unknown as Json,
            steps: recipe.steps as unknown as Json,
            base_servings: recipe.servings,
          })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('recipe_cards')
          .insert([{
            meal_id: mealId,
            meal_name: recipe.name,
            image_url: recipe.image_url || null,
            ingredients: recipe.ingredients as unknown as Json,
            steps: recipe.steps as unknown as Json,
            base_servings: recipe.servings,
          }]);
        if (insertError) throw insertError;
      }

      // Also update the meal record with extracted name and cook time
      const { error: mealUpdateError } = await supabase
        .from('meals')
        .update({
          meal_name: recipe.name,
          estimated_cook_minutes: recipe.estimated_cook_minutes || null,
        })
        .eq('id', mealId);
      
      if (mealUpdateError) {
        console.error('Failed to update meal with extracted data:', mealUpdateError);
        // Don't throw - recipe card was created successfully
      }

      return recipe;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
      if (result && 'extraction_failed' in result) {
        toast.warning('Could not extract recipe from URL');
      } else {
        toast.success('Recipe extracted!');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const processCookbook = useMutation({
    mutationFn: async ({ recipeText, cookbookTitle, recipeName }: ProcessCookbookParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-cookbook-recipe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ recipeText, cookbookTitle, recipeName }),
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
        throw new Error(errorData.error || 'Failed to process recipe');
      }

      const { recipe }: { recipe: ExtractedRecipe } = await response.json();
      return recipe;
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return { extractFromUrl, processCookbook };
}
