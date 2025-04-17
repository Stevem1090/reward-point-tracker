import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getVapidPublicKey, urlBase64ToUint8Array } from '@/utils/vapidUtils';
import { useToast } from '@/hooks/use-toast';

export const usePushNotifications = (initialFamilyMemberId: string) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const checkSubscriptionStatus = useCallback(async (familyMemberId: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported in this browser');
      return false;
    }

    try {
      const { data } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('family_member_id', familyMemberId)
        .maybeSingle();

      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return false;

      const existingSub = await reg.pushManager.getSubscription();
      
      return !!(data && existingSub);
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      if (!initialFamilyMemberId) {
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
        
        const isSubbed = await checkSubscriptionStatus(initialFamilyMemberId);
        setIsSubscribed(isSubbed);
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [initialFamilyMemberId, checkSubscriptionStatus]);

  const subscribe = useCallback(async (familyMemberId: string) => {
    setIsLoading(true);
    try {
      let reg = registration;
      if (!reg) {
        console.log('Registering service worker for push notifications');
        reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        console.log('Service worker registered successfully');
        setRegistration(reg);
      }
      
      console.log('Fetching VAPID public key for subscription');
      const publicKey = await getVapidPublicKey();
      if (!publicKey) {
        console.error('Failed to retrieve VAPID public key');
        throw new Error('VAPID public key not available');
      }
      console.log('VAPID public key retrieved, length:', publicKey.length);

      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        console.log('Unsubscribing from existing push subscription');
        await existingSub.unsubscribe();
        console.log('Successfully unsubscribed from existing subscription');
      }

      console.log('Processing VAPID key to applicationServerKey');
      let applicationServerKey;
      try {
        applicationServerKey = urlBase64ToUint8Array(publicKey);
        console.log('ApplicationServerKey created successfully, length:', applicationServerKey.length);
      } catch (keyError) {
        console.error('Error processing VAPID key:', keyError);
        throw new Error(`Failed to process VAPID key: ${keyError.message}`);
      }

      console.log('Creating new push subscription');
      let newSubscription: PushSubscription;
      try {
        newSubscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
        console.log('Push subscription created successfully:', newSubscription.endpoint);
      } catch (subscribeError) {
        console.error('Error creating push subscription:', subscribeError);
        throw new Error(`Failed to subscribe to push notifications: ${subscribeError.message}`);
      }

      console.log('Extracting subscription keys');
      let p256dhKey: string;
      let authKey: string;
      
      try {
        const p256dhRaw = new Uint8Array(newSubscription.getKey('p256dh')!);
        const authRaw = new Uint8Array(newSubscription.getKey('auth')!);
        
        p256dhKey = btoa(
          String.fromCharCode.apply(null, Array.from(p256dhRaw))
        );
        
        authKey = btoa(
          String.fromCharCode.apply(null, Array.from(authRaw))
        );
        
        console.log('Subscription keys processed successfully');
      } catch (keyError) {
        console.error('Error processing subscription keys:', keyError);
        throw new Error(`Failed to process subscription keys: ${keyError.message}`);
      }

      console.log('Saving subscription to database for family member:', familyMemberId);
      const { error } = await supabase.from('push_subscriptions').upsert({
        family_member_id: familyMemberId,
        endpoint: newSubscription.endpoint,
        p256dh: p256dhKey,
        auth: authKey,
      }, {
        onConflict: 'family_member_id'
      });

      if (error) {
        console.error('Database error saving subscription:', error);
        throw error;
      }
      
      console.log('Subscription saved successfully');
      setSubscription(newSubscription);
      if (familyMemberId === initialFamilyMemberId) {
        setIsSubscribed(true);
      }
      
      toast({
        title: "Notifications Enabled",
        description: "You'll receive reminder notifications",
      });
      
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      
      toast({
        title: "Notification Error",
        description: error.message || "Failed to enable notifications. Please try again.",
        variant: "destructive"
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registration, initialFamilyMemberId, toast]);

  const unsubscribe = useCallback(async (familyMemberId: string) => {
    setIsLoading(true);
    try {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('family_member_id', familyMemberId);
      
      if (familyMemberId === initialFamilyMemberId) {
        setIsSubscribed(false);
      }
      
      const { count } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true });
      
      if (count === 0 && subscription) {
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
  }, [subscription, initialFamilyMemberId, toast]);

  return {
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    checkSubscriptionStatus,
  };
};
