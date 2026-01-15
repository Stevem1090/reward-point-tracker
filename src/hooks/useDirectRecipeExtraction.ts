import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Ingredient } from '@/types/meal';

export interface ExtractedRecipe {
  name: string;
  description?: string;
  servings: number;
  estimated_cook_minutes?: number;
  ingredients: Ingredient[];
  steps: string[];
  image_url?: string;
  source_url?: string;
}

interface ExtractFromUrlParams {
  url: string;
}

interface ProcessCookbookParams {
  recipeText: string;
  cookbookTitle?: string;
  recipeName?: string;
}

// Map API response ingredients to Ingredient type (API uses 'item', our type uses 'name')
function mapIngredients(ingredients: Array<{ item?: string; name?: string; quantity: string; unit: string }>): Ingredient[] {
  return ingredients.map(ing => ({
    name: ing.name || ing.item || '',
    quantity: ing.quantity || '',
    unit: ing.unit || ''
  }));
}

export function useDirectRecipeExtraction() {
  const extractFromUrl = useMutation({
    mutationFn: async ({ url }: ExtractFromUrlParams): Promise<ExtractedRecipe> => {
      const { data, error } = await supabase.functions.invoke('extract-recipe-from-url', {
        body: { url, mealName: '' }
      });

      if (error) {
        console.error('Error extracting recipe:', error);
        throw new Error(error.message || 'Failed to extract recipe');
      }

      if (!data) {
        throw new Error('No recipe data returned');
      }

      return {
        name: data.name || 'Untitled Recipe',
        description: data.description,
        servings: data.servings || 4,
        estimated_cook_minutes: data.estimated_cook_minutes,
        ingredients: mapIngredients(data.ingredients || []),
        steps: data.steps || [],
        image_url: data.image_url,
        source_url: data.source_url || url
      };
    },
    onError: (error: Error) => {
      console.error('Extract from URL error:', error);
      toast.error('Failed to extract recipe', {
        description: error.message
      });
    }
  });

  const processCookbook = useMutation({
    mutationFn: async ({ recipeText, cookbookTitle, recipeName }: ProcessCookbookParams): Promise<ExtractedRecipe> => {
      const { data, error } = await supabase.functions.invoke('process-cookbook-recipe', {
        body: { recipeText, cookbookTitle, recipeName }
      });

      if (error) {
        console.error('Error processing cookbook recipe:', error);
        throw new Error(error.message || 'Failed to process recipe');
      }

      if (!data) {
        throw new Error('No recipe data returned');
      }

      return {
        name: data.name || recipeName || 'Untitled Recipe',
        description: data.description,
        servings: data.servings || 4,
        estimated_cook_minutes: data.estimated_cook_minutes,
        ingredients: mapIngredients(data.ingredients || []),
        steps: data.steps || [],
        image_url: data.image_url
      };
    },
    onError: (error: Error) => {
      console.error('Process cookbook error:', error);
      toast.error('Failed to process recipe', {
        description: error.message
      });
    }
  });

  return {
    extractFromUrl,
    processCookbook
  };
}
