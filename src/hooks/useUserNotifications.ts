
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionResponse } from '@/types/user';
import { useSubscriptionManager } from './notifications/useSubscriptionManager';
import { useNotificationDatabase } from './notifications/useNotificationDatabase';

export const useUserNotifications = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { 
    subscription,
    createSubscription,
    removeSubscription 
  } = useSubscriptionManager();
  
  const {
    saveSubscription,
    removeSubscriptionFromDb,
    checkSubscriptionExists
  } = useNotificationDatabase();

  const checkSubscriptionStatus = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return false;
    }
    
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsLoading(false);
      return false;
    }

    try {
      const isSubbed = await checkSubscriptionExists(user.id);
      setIsSubscribed(isSubbed);
      setIsLoading(false);
      return isSubbed;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setIsLoading(false);
      return false;
    }
  }, [user?.id, checkSubscriptionExists]);

  useEffect(() => {
    checkSubscriptionStatus();
  }, [user?.id, checkSubscriptionStatus]);

  const subscribe = useCallback(async (): Promise<SubscriptionResponse> => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to enable notifications",
        variant: "destructive"
      });
      return { success: false, message: "User not logged in" };
    }
    
    setIsLoading(true);
    try {
      const result = await createSubscription();
      if (!result) {
        throw new Error("Failed to create subscription");
      }

      const { subscription, keys } = result;
      const dbResult = await saveSubscription(
        user.id,
        subscription.endpoint,
        keys.p256dhKey,
        keys.authKey
      );

      if (dbResult.success) {
        setIsSubscribed(true);
        toast({
          title: "Notifications Enabled",
          description: "You'll receive reminder notifications",
        });
      }

      return dbResult;
    } catch (error: any) {
      console.error('Error subscribing to push notifications:', error);
      toast({
        title: "Notification Error",
        description: error.message || "Failed to enable notifications",
        variant: "destructive"
      });
      return { success: false, message: error.message || "Unknown error" };
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, createSubscription, saveSubscription, toast]);

  const unsubscribe = useCallback(async (): Promise<SubscriptionResponse> => {
    if (!user?.id) {
      return { success: false, message: "User not logged in" };
    }
    
    setIsLoading(true);
    try {
      const dbResult = await removeSubscriptionFromDb(user.id);
      if (dbResult.success) {
        await removeSubscription();
        setIsSubscribed(false);
        toast({
          title: "Notifications Disabled",
          description: "You won't receive reminder notifications",
        });
      }
      return dbResult;
    } catch (error: any) {
      console.error('Error unsubscribing:', error);
      toast({
        title: "Error",
        description: "Failed to disable notifications",
        variant: "destructive"
      });
      return { success: false, message: error.message || "Unknown error" };
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, removeSubscription, removeSubscriptionFromDb, toast]);

  return {
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    checkSubscriptionStatus
  };
};
