import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Income } from '@/types/bill';
import { toast } from 'sonner';

export const useIncomes = () => {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncomes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('incomes')
        .select('*')
        .order('name');

      if (error) throw error;
      setIncomes((data as Income[]) || []);
    } catch (error) {
      console.error('Error fetching incomes:', error);
      toast.error('Failed to load income');
    } finally {
      setLoading(false);
    }
  };

  const createIncome = async (
    income: Omit<Income, 'id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const { data, error } = await supabase
        .from('incomes')
        .insert(income)
        .select()
        .single();

      if (error) throw error;
      toast.success('Income added');
      await fetchIncomes();
      return data;
    } catch (error) {
      console.error('Error creating income:', error);
      toast.error('Failed to add income');
      throw error;
    }
  };

  const updateIncome = async (
    id: string,
    updates: Partial<Omit<Income, 'id' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      const { error } = await supabase.from('incomes').update(updates).eq('id', id);
      if (error) throw error;
      toast.success('Income updated');
      await fetchIncomes();
    } catch (error) {
      console.error('Error updating income:', error);
      toast.error('Failed to update income');
      throw error;
    }
  };

  const deleteIncome = async (id: string) => {
    try {
      const { error } = await supabase.from('incomes').delete().eq('id', id);
      if (error) throw error;
      toast.success('Income deleted');
      await fetchIncomes();
    } catch (error) {
      console.error('Error deleting income:', error);
      toast.error('Failed to delete income');
      throw error;
    }
  };

  useEffect(() => {
    fetchIncomes();
  }, []);

  return {
    incomes,
    loading,
    createIncome,
    updateIncome,
    deleteIncome,
    refetch: fetchIncomes,
  };
};
