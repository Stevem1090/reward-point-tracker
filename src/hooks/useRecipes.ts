import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Recipe, Ingredient, RecipeSourceType } from '@/types/meal';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

export function useRecipes() {
  const queryClient = useQueryClient();

  const recipesQuery = useQuery({
    queryKey: ['recipes'],
    queryFn: async (): Promise<Recipe[]> => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(recipe => ({
        ...recipe,
        source_type: recipe.source_type as RecipeSourceType,
        ingredients: (recipe.ingredients as unknown as Ingredient[]) || [],
        steps: (recipe.steps as unknown as string[]) || []
      }));
    }
  });

  const createRecipe = useMutation({
    mutationFn: async (recipe: Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('recipes')
        .insert([{
          ...recipe,
          user_id: userId,
          ingredients: recipe.ingredients as unknown as Json,
          steps: recipe.steps as unknown as Json
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Recipe saved!');
    },
    onError: () => toast.error('Failed to save recipe')
  });

  const updateRecipe = useMutation({
    mutationFn: async ({ id, ingredients, steps, ...updates }: Partial<Recipe> & { id: string }) => {
      const { error } = await supabase
        .from('recipes')
        .update({
          ...updates,
          ...(ingredients && { ingredients: ingredients as unknown as Json }),
          ...(steps && { steps: steps as unknown as Json })
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Recipe updated!');
    },
    onError: () => toast.error('Failed to update recipe')
  });

  const deleteRecipe = useMutation({
    mutationFn: async (recipeId: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Recipe deleted');
    },
    onError: () => toast.error('Failed to delete recipe')
  });

  /**
   * Upsert SW info on the recipe linked to a meal.
   * If the meal has no recipe_id, auto-creates a library recipe (using the meal's
   * recipe_card data when available) and links it back to the meal.
   */
  const upsertSwInfo = useMutation({
    mutationFn: async ({
      mealId,
      recipeId,
      mealName,
      description,
      servings,
      estimatedCookMinutes,
      recipeUrl,
      ingredients,
      steps,
      imageUrl,
      sw,
    }: {
      mealId: string;
      recipeId: string | null;
      mealName: string;
      description?: string | null;
      servings?: number;
      estimatedCookMinutes?: number | null;
      recipeUrl?: string | null;
      ingredients?: Ingredient[];
      steps?: string[];
      imageUrl?: string | null;
      sw: {
        sw_swips: number | null;
        sw_healthy_extra_type: 'calcium' | 'fibre' | 'healthy_fats' | null;
        sw_healthy_extra_amount: number | null;
        sw_is_speed: boolean | null;
      };
    }) => {
      const userId = await getCurrentUserId();
      let targetRecipeId = recipeId;

      if (!targetRecipeId) {
        const { data: created, error: createErr } = await supabase
          .from('recipes')
          .insert([{
            user_id: userId,
            name: mealName,
            description: description ?? null,
            servings: servings ?? 4,
            estimated_cook_minutes: estimatedCookMinutes ?? null,
            recipe_url: recipeUrl ?? null,
            image_url: imageUrl ?? null,
            ingredients: (ingredients ?? []) as unknown as Json,
            steps: (steps ?? []) as unknown as Json,
            source_type: recipeUrl ? 'website' : 'ai_generated',
            ...sw,
          }])
          .select('id')
          .single();
        if (createErr) throw createErr;
        targetRecipeId = created.id;

        const { error: linkErr } = await supabase
          .from('meals')
          .update({ recipe_id: targetRecipeId })
          .eq('id', mealId);
        if (linkErr) throw linkErr;
      } else {
        const { error: updErr } = await supabase
          .from('recipes')
          .update(sw)
          .eq('id', targetRecipeId);
        if (updErr) throw updErr;
      }

      return targetRecipeId as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
      queryClient.invalidateQueries({ queryKey: ['recipeStats'] });
      toast.success('SW info saved');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save SW info'),
  });

  return {
    recipes: recipesQuery.data || [],
    isLoading: recipesQuery.isLoading,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    upsertSwInfo,
  };
}
