import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bill } from '@/types/bill';
import { toast } from 'sonner';

export const useBills = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          bill_type:bill_types(*)
        `)
        .order('name');

      if (error) throw error;
      setBills((data as Bill[]) || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const createBill = async (bill: Omit<Bill, 'id' | 'created_at' | 'updated_at' | 'bill_type'>) => {
    try {
      // If monthly and no payment_day specified, explicitly set to 1
      const billData = {
        ...bill,
        payment_day:
          bill.frequency === 'monthly' && !bill.payment_day ? 1 : bill.payment_day,
      };

      const { data, error } = await supabase
        .from('bills')
        .insert(billData)
        .select()
        .single();

      if (error) throw error;
      toast.success('Bill created');
      await fetchBills();
      return data;
    } catch (error) {
      console.error('Error creating bill:', error);
      toast.error('Failed to create bill');
      throw error;
    }
  };

  const updateBill = async (
    id: string,
    updates: Partial<Omit<Bill, 'id' | 'created_at' | 'updated_at' | 'bill_type'>>
  ) => {
    try {
      const { error } = await supabase.from('bills').update(updates).eq('id', id);

      if (error) throw error;
      toast.success('Bill updated');
      await fetchBills();
    } catch (error) {
      console.error('Error updating bill:', error);
      toast.error('Failed to update bill');
      throw error;
    }
  };

  const deleteBill = async (id: string) => {
    try {
      const { error } = await supabase.from('bills').delete().eq('id', id);

      if (error) throw error;
      toast.success('Bill deleted');
      await fetchBills();
    } catch (error) {
      console.error('Error deleting bill:', error);
      toast.error('Failed to delete bill');
      throw error;
    }
  };

  const toggleBillActive = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('bills')
        .update({ active })
        .eq('id', id);

      if (error) throw error;
      toast.success(active ? 'Bill activated' : 'Bill deactivated');
      await fetchBills();
    } catch (error) {
      console.error('Error toggling bill:', error);
      toast.error('Failed to update bill');
      throw error;
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  return {
    bills,
    loading,
    createBill,
    updateBill,
    deleteBill,
    toggleBillActive,
    refetch: fetchBills,
  };
};
