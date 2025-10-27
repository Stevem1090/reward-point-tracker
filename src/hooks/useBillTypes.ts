import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BillType } from '@/types/bill';
import { toast } from 'sonner';

export const useBillTypes = () => {
  const [billTypes, setBillTypes] = useState<BillType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBillTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bill_types')
        .select('*')
        .order('name');

      if (error) throw error;
      setBillTypes(data || []);
    } catch (error) {
      console.error('Error fetching bill types:', error);
      toast.error('Failed to load bill types');
    } finally {
      setLoading(false);
    }
  };

  const createBillType = async (
    billType: Omit<BillType, 'id' | 'created_at'>
  ) => {
    try {
      const { data, error } = await supabase
        .from('bill_types')
        .insert(billType)
        .select()
        .single();

      if (error) throw error;
      toast.success('Bill type created');
      await fetchBillTypes();
      return data;
    } catch (error) {
      console.error('Error creating bill type:', error);
      toast.error('Failed to create bill type');
      throw error;
    }
  };

  const updateBillType = async (
    id: string,
    updates: Partial<Omit<BillType, 'id' | 'created_at'>>
  ) => {
    try {
      const { error } = await supabase
        .from('bill_types')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success('Bill type updated');
      await fetchBillTypes();
    } catch (error) {
      console.error('Error updating bill type:', error);
      toast.error('Failed to update bill type');
      throw error;
    }
  };

  const deleteBillType = async (id: string) => {
    try {
      // Check if any bills are using this type
      const { data: bills } = await supabase
        .from('bills')
        .select('id')
        .eq('bill_type_id', id)
        .limit(1);

      if (bills && bills.length > 0) {
        toast.error('Cannot delete bill type that is in use');
        return;
      }

      const { error } = await supabase.from('bill_types').delete().eq('id', id);

      if (error) throw error;
      toast.success('Bill type deleted');
      await fetchBillTypes();
    } catch (error) {
      console.error('Error deleting bill type:', error);
      toast.error('Failed to delete bill type');
      throw error;
    }
  };

  useEffect(() => {
    fetchBillTypes();
  }, []);

  return {
    billTypes,
    loading,
    createBillType,
    updateBillType,
    deleteBillType,
    refetch: fetchBillTypes,
  };
};
