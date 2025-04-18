
import { supabase } from '@/integrations/supabase/client';
import { SubscriptionResponse } from '@/types/user';

export const useNotificationDatabase = () => {
  // Helper function to implement timeout for database operations
  const withTimeout = async <T>(promise: Promise<T>, timeoutMs = 5000, fallback?: T): Promise<T> => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database operation timed out')), timeoutMs);
      });
      
      return await Promise.race([promise, timeoutPromise]);
    } catch (error) {
      console.error('Database operation error or timeout:', error);
      if (fallback !== undefined) {
        return fallback;
      }
      throw error;
    }
  };

  const saveSubscription = async (
    userId: string, 
    endpoint: string, 
    p256dhKey: string, 
    authKey: string
  ): Promise<SubscriptionResponse> => {
    try {
      const checkExistingPromise = supabase
        .from('user_push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .maybeSingle();
      
      const { data: existingData } = await withTimeout(checkExistingPromise);

      if (existingData?.id) {
        const updatePromise = supabase
          .from('user_push_subscriptions')
          .update({ p256dh: p256dhKey, auth: authKey })
          .eq('id', existingData.id);
          
        const { error: updateError } = await withTimeout(updatePromise);
        if (updateError) throw updateError;
      } else {
        const insertPromise = supabase
          .from('user_push_subscriptions')
          .insert({
            user_id: userId,
            endpoint,
            p256dh: p256dhKey,
            auth: authKey,
          });
          
        const { error: insertError } = await withTimeout(insertPromise);
        if (insertError) throw insertError;
      }

      return { success: true, message: "Subscription saved successfully" };
    } catch (error: any) {
      console.error('Database error:', error);
      return { 
        success: false, 
        message: error.message || "Failed to save subscription" 
      };
    }
  };

  const removeSubscriptionFromDb = async (userId: string): Promise<SubscriptionResponse> => {
    try {
      const deletePromise = supabase
        .from('user_push_subscriptions')
        .delete()
        .eq('user_id', userId);
        
      const { error } = await withTimeout(deletePromise);
      if (error) throw error;
      
      return { success: true, message: "Subscription removed successfully" };
    } catch (error: any) {
      console.error('Database error:', error);
      return { 
        success: false, 
        message: error.message || "Failed to remove subscription" 
      };
    }
  };

  const checkSubscriptionExists = async (userId: string): Promise<boolean> => {
    try {
      const checkPromise = supabase
        .from('user_push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
        
      const { data } = await withTimeout(checkPromise, 5000, { data: null });
      return !!data;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
  };

  // Method to clean up expired subscriptions
  const cleanupExpiredSubscriptions = async (): Promise<void> => {
    try {
      // This function would typically be called by an admin or background process
      // It could delete all subscriptions marked as expired by push notification attempts
      console.log('Cleanup of expired subscriptions would happen here');
      // Actual implementation would depend on how you track expired subscriptions
    } catch (error) {
      console.error('Error cleaning up expired subscriptions:', error);
    }
  };

  return {
    saveSubscription,
    removeSubscriptionFromDb,
    checkSubscriptionExists,
    cleanupExpiredSubscriptions
  };
};
