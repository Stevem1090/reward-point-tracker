import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Recipe, Ingredient, RecipeSourceType } from '@/types/meal';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

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
      const { data, error } = await supabase
        .from('recipes')
        .insert([{
          ...recipe,
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

  return {
    recipes: recipesQuery.data || [],
    isLoading: recipesQuery.isLoading,
    createRecipe,
    updateRecipe,
    deleteRecipe
  };
}
