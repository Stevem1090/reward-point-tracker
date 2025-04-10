
import { supabase } from '@/integrations/supabase/client';
import { RewardCategory } from '@/types/reward';

export const addCategory = async (category: Omit<RewardCategory, 'id'>): Promise<RewardCategory | null> => {
  const { data, error } = await supabase
    .from('reward_categories')
    .insert({
      name: category.name,
      point_value: category.pointValue,
      description: category.description
    })
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  if (data) {
    return {
      id: data.id,
      name: data.name,
      pointValue: data.point_value,
      description: data.description || ''
    };
  }
  
  return null;
};

export const updateCategory = async (updatedCategory: RewardCategory): Promise<void> => {
  const { error } = await supabase
    .from('reward_categories')
    .update({
      name: updatedCategory.name,
      point_value: updatedCategory.pointValue,
      description: updatedCategory.description
    })
    .eq('id', updatedCategory.id);
  
  if (error) {
    throw error;
  }
};

export const deleteCategory = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('reward_categories')
    .delete()
    .eq('id', id);
  
  if (error) {
    throw error;
  }
};

export const fetchCategories = async (): Promise<RewardCategory[]> => {
  const { data, error } = await supabase
    .from('reward_categories')
    .select('*')
    .order('name');
  
  if (error) {
    throw error;
  }
  
  if (data) {
    return data.map(category => ({
      id: category.id,
      name: category.name,
      pointValue: category.point_value,
      description: category.description || ''
    }));
  }
  
  return [];
};
