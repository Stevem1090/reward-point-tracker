import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BillAccount } from '@/types/bill';
import { toast } from 'sonner';

export const useBillAccounts = () => {
  const [accounts, setAccounts] = useState<BillAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bill_accounts')
        .select('*')
        .order('sort_order')
        .order('name');

      if (error) throw error;
      setAccounts((data as BillAccount[]) || []);
    } catch (error) {
      console.error('Error fetching bill accounts:', error);
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async (
    account: Omit<BillAccount, 'id' | 'created_at'>
  ) => {
    try {
      const { data, error } = await supabase
        .from('bill_accounts')
        .insert(account)
        .select()
        .single();

      if (error) throw error;
      toast.success('Account created');
      await fetchAccounts();
      return data;
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error('Failed to create account');
      throw error;
    }
  };

  const updateAccount = async (
    id: string,
    updates: Partial<Omit<BillAccount, 'id' | 'created_at'>>
  ) => {
    try {
      const { error } = await supabase
        .from('bill_accounts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success('Account updated');
      await fetchAccounts();
    } catch (error) {
      console.error('Error updating account:', error);
      toast.error('Failed to update account');
      throw error;
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      const { error } = await supabase.from('bill_accounts').delete().eq('id', id);
      if (error) throw error;
      toast.success('Account deleted');
      await fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
      throw error;
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return {
    accounts,
    loading,
    createAccount,
    updateAccount,
    deleteAccount,
    refetch: fetchAccounts,
  };
};
