
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { RewardCategory } from '@/types/reward';
import { fetchCategories, addCategory as addCategoryUtil, updateCategory as updateCategoryUtil, deleteCategory as deleteCategoryUtil } from '@/utils/categoryUtils';
import { supabase } from '@/integrations/supabase/client';

export const useCategories = () => {
  const [categories, setCategories] = useState<RewardCategory[]>([]);
  const { toast } = useToast();

  const fetchAllCategories = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchAllCategories();
    
    const categorySubscription = supabase
      .channel('public:reward_categories')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reward_categories'
      }, () => {
        fetchAllCategories();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(categorySubscription);
    };
  }, []);

  const addCategory = async (category: Omit<RewardCategory, 'id'>) => {
    try {
      const newCategory = await addCategoryUtil(category);
      
      if (newCategory) {
        toast({
          title: "Category Added",
          description: `${category.name} has been added as a new category`,
        });
      }
    } catch (error) {
      console.error('Error adding category:', error);
      toast({
        title: "Error",
        description: "Failed to add category",
        variant: "destructive",
      });
    }
  };

  const updateCategory = async (updatedCategory: RewardCategory) => {
    try {
      await updateCategoryUtil(updatedCategory);
      
      toast({
        title: "Category Updated",
        description: `${updatedCategory.name} has been updated`,
      });
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const categoryToDelete = categories.find(cat => cat.id === id);
      if (!categoryToDelete) return;
      
      await deleteCategoryUtil(id);
      
      toast({
        title: "Category Deleted",
        description: `${categoryToDelete.name} has been removed`,
        variant: "destructive",
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  return { categories, addCategory, updateCategory, deleteCategory };
};
