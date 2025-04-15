
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
      // Check if there's a subscription in the database
      const { data, error } = await supabase
        .from('user_push_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking database subscription:', error);
        return false;
      }

      // Check if there's an active service worker subscription
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        console.log('No service worker registration found');
        return false;
      }

      const existingSub = await reg.pushManager.getSubscription();
      
      // User is considered subscribed if they have both a database entry and an active browser subscription
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

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported in this browser');
        setIsLoading(false);
        return;
      }

      try {
        // Get service worker registration
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          console.log('Service worker not registered yet');
          setIsLoading(false);
          return;
        }
        
        setRegistration(registration);
        
        // Get existing push subscription from browser
        const existingSubscription = await registration.pushManager.getSubscription();
        setSubscription(existingSubscription);
        
        // Check if user is subscribed
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
    
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast({
        title: "Error",
        description: "Your browser doesn't support push notifications",
        variant: "destructive"
      });
      return false;
    }
    
    setIsLoading(true);
    try {
      // Get or register service worker
      let reg = registration;
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        setRegistration(reg);
      }
      
      // Get VAPID public key
      const publicKey = await getVapidPublicKey();
      if (!publicKey) {
        throw new Error('VAPID public key not available');
      }

      // Unsubscribe from any existing subscription
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      // Create new subscription
      const newSubscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Convert keys to base64
      const p256dhKey = btoa(
        String.fromCharCode.apply(null, Array.from(new Uint8Array(newSubscription.getKey('p256dh')!)))
      );
      
      const authKey = btoa(
        String.fromCharCode.apply(null, Array.from(new Uint8Array(newSubscription.getKey('auth')!)))
      );

      // Save subscription to database
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
      // Remove from database
      const { error } = await supabase
        .from('user_push_subscriptions')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setIsSubscribed(false);
      
      // Unsubscribe from push manager
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
