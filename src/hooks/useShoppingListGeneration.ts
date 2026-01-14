import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Ingredient, ShoppingListItem } from '@/types/meal';
import { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';

interface MealIngredients {
  mealName: string;
  servings: number;
  ingredients: Ingredient[];
}

interface GenerateShoppingListParams {
  mealPlanId: string;
  meals: MealIngredients[];
}

export function useShoppingListGeneration() {
  const queryClient = useQueryClient();

  const generateShoppingList = useMutation({
    mutationFn: async ({ mealPlanId, meals }: GenerateShoppingListParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-shopping-list`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ meals }),
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
        throw new Error(errorData.error || 'Failed to generate shopping list');
      }

      const { items }: { items: ShoppingListItem[] } = await response.json();

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if shopping list already exists for this meal plan
      const { data: existing } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('meal_plan_id', mealPlanId)
        .maybeSingle();

      let upsertError = null;
      if (existing) {
        const { error } = await supabase
          .from('shopping_lists')
          .update({ items: items as unknown as Json })
          .eq('id', existing.id);
        upsertError = error;
      } else {
        const { error } = await supabase
          .from('shopping_lists')
          .insert([{
            user_id: user.id,
            meal_plan_id: mealPlanId,
            items: items as unknown as Json,
          }]);
        upsertError = error;
      }

      if (upsertError) throw upsertError;

      return items;
    },
    onSuccess: (_, { mealPlanId }) => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList', mealPlanId] });
      toast.success('Shopping list generated!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return { generateShoppingList };
}
