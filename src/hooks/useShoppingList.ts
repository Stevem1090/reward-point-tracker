import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingList, ShoppingListItem } from '@/types/meal';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { Json } from '@/integrations/supabase/types';

export function useShoppingList(mealPlanId: string | null) {
  const queryClient = useQueryClient();

  const shoppingListQuery = useQuery({
    queryKey: ['shoppingList', mealPlanId],
    queryFn: async (): Promise<ShoppingList | null> => {
      if (!mealPlanId) return null;
      
      const { data, error } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('meal_plan_id', mealPlanId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        ...data,
        items: (data.items as unknown as ShoppingListItem[]) || []
      };
    },
    enabled: !!mealPlanId
  });

  const toggleItem = useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const currentList = shoppingListQuery.data;
      if (!currentList) throw new Error('No shopping list');

      const updatedItems = currentList.items.map(item =>
        item.id === itemId ? { ...item, checked } : item
      );

      const { error } = await supabase
        .from('shopping_lists')
        .update({ items: updatedItems as unknown as Json })
        .eq('id', currentList.id);

      if (error) throw error;
    },
    onMutate: async ({ itemId, checked }) => {
      await queryClient.cancelQueries({ queryKey: ['shoppingList', mealPlanId] });
      const previousList = queryClient.getQueryData(['shoppingList', mealPlanId]);

      queryClient.setQueryData(['shoppingList', mealPlanId], (old: ShoppingList | null) => {
        if (!old) return old;
        return { ...old, items: old.items.map(item => item.id === itemId ? { ...item, checked } : item) };
      });

      return { previousList };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousList) queryClient.setQueryData(['shoppingList', mealPlanId], context.previousList);
      toast.error('Failed to update item');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['shoppingList', mealPlanId] })
  });

  const addItem = useMutation({
    mutationFn: async (item: Omit<ShoppingListItem, 'id'>) => {
      const currentList = shoppingListQuery.data;
      if (!currentList) throw new Error('No shopping list');

      const updatedItems = [...currentList.items, { ...item, id: uuidv4() }];
      const { error } = await supabase
        .from('shopping_lists')
        .update({ items: updatedItems as unknown as Json })
        .eq('id', currentList.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList', mealPlanId] });
      toast.success('Item added');
    },
    onError: () => toast.error('Failed to add item')
  });

  const clearChecked = useMutation({
    mutationFn: async () => {
      const currentList = shoppingListQuery.data;
      if (!currentList) throw new Error('No shopping list');

      const updatedItems = currentList.items.filter(i => !i.checked);
      const { error } = await supabase
        .from('shopping_lists')
        .update({ items: updatedItems as unknown as Json })
        .eq('id', currentList.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList', mealPlanId] });
      toast.success('Checked items cleared');
    },
    onError: () => toast.error('Failed to clear items')
  });

  const groupedItems = () => {
    const items = shoppingListQuery.data?.items || [];
    const groups: Record<string, ShoppingListItem[]> = {};
    items.forEach(item => {
      const category = item.category || 'Other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
    });
    return groups;
  };

  return {
    shoppingList: shoppingListQuery.data,
    items: shoppingListQuery.data?.items || [],
    groupedItems: groupedItems(),
    isLoading: shoppingListQuery.isLoading,
    toggleItem,
    addItem,
    clearChecked
  };
}
