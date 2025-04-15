
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getVapidPublicKey, urlBase64ToUint8Array } from '@/utils/vapidUtils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export const useUserNotifications = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const checkSubscriptionStatus = useCallback(async () => {
    if (!user?.id || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported or user not logged in');
      return false;
    }

    try {
      const { data } = await supabase
        .from('user_push_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return false;

      const existingSub = await reg.pushManager.getSubscription();
      
      return !!(data && existingSub);
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }, [user?.id]);

  useEffect(() => {
    const loadInitialData = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          console.log('Service worker not registered yet');
          setIsLoading(false);
          return;
        }
        
        setRegistration(registration);
        const existingSubscription = await registration.pushManager.getSubscription();
        setSubscription(existingSubscription);
        
        const isSubbed = await checkSubscriptionStatus();
        setIsSubscribed(isSubbed);
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [user?.id, checkSubscriptionStatus]);

  const subscribe = useCallback(async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to enable notifications",
        variant: "destructive"
      });
      return false;
    }
    
    setIsLoading(true);
    try {
      let reg = registration;
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        setRegistration(reg);
      }
      
      const publicKey = await getVapidPublicKey();
      if (!publicKey) {
        throw new Error('VAPID public key not available');
      }

      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      const newSubscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const p256dhKey = btoa(
        String.fromCharCode.apply(null, Array.from(new Uint8Array(newSubscription.getKey('p256dh')!)))
      );
      
      const authKey = btoa(
        String.fromCharCode.apply(null, Array.from(new Uint8Array(newSubscription.getKey('auth')!)))
      );

      const { error } = await supabase
        .from('user_push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: newSubscription.endpoint,
          p256dh: p256dhKey,
          auth: authKey,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setSubscription(newSubscription);
      setIsSubscribed(true);
      
      toast({
        title: "Notifications Enabled",
        description: "You'll receive reminder notifications",
      });
      
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      
      toast({
        title: "Notification Error",
        description: "Failed to enable notifications. Please try again.",
        variant: "destructive"
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registration, user?.id, toast]);

  const unsubscribe = useCallback(async () => {
    if (!user?.id) return false;
    
    setIsLoading(true);
    try {
      await supabase
        .from('user_push_subscriptions')
        .delete()
        .eq('user_id', user.id);
      
      setIsSubscribed(false);
      
      if (subscription) {
        await subscription.unsubscribe();
        setSubscription(null);
      }
      
      toast({
        title: "Notifications Disabled",
        description: "You won't receive reminder notifications",
      });
      
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      
      toast({
        title: "Error",
        description: "Failed to disable notifications. Please try again.",
        variant: "destructive"
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [subscription, user?.id, toast]);

  return {
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe
  };
};
