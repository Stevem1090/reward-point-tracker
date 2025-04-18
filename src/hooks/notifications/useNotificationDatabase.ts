
import { supabase } from '@/integrations/supabase/client';
import { SubscriptionResponse } from '@/types/user';

export const useNotificationDatabase = () => {
  const saveSubscription = async (
    userId: string, 
    endpoint: string, 
    p256dhKey: string, 
    authKey: string
  ): Promise<SubscriptionResponse> => {
    try {
      const { data: existingData } = await supabase
        .from('user_push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .maybeSingle();

      if (existingData?.id) {
        const { error: updateError } = await supabase
          .from('user_push_subscriptions')
          .update({ p256dh: p256dhKey, auth: authKey })
          .eq('id', existingData.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('user_push_subscriptions')
          .insert({
            user_id: userId,
            endpoint,
            p256dh: p256dhKey,
            auth: authKey,
          });

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
      const { error } = await supabase
        .from('user_push_subscriptions')
        .delete()
        .eq('user_id', userId);

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
      const { data } = await supabase
        .from('user_push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      return !!data;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
  };

  return {
    saveSubscription,
    removeSubscriptionFromDb,
    checkSubscriptionExists
  };
};
