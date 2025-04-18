
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getVapidPublicKey, urlBase64ToUint8Array } from '@/utils/vapidUtils';
import { useToast } from '@/hooks/use-toast';
import { SubscriptionResponse } from '@/types/user';

export const usePushNotifications = (initialFamilyMemberId: string) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const checkSubscriptionStatus = useCallback(async (userId: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported in this browser');
      return false;
    }

    try {
      const { data } = await supabase
        .from('user_push_subscriptions')
        .select('*')
        .eq('user_id', userId)
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

  const subscribe = useCallback(async (userId: string): Promise<SubscriptionResponse> => {
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
      } catch (keyError: any) {
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
      } catch (subscribeError: any) {
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
      } catch (keyError: any) {
        console.error('Error processing subscription keys:', keyError);
        throw new Error(`Failed to process subscription keys: ${keyError.message}`);
      }

      console.log('Checking for existing subscription in database');
      const { data: existingData, error: checkError } = await supabase
        .from('user_push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing subscription:', checkError);
        throw checkError;
      }

      if (existingData?.id) {
        console.log('Updating existing subscription in database');
        const { error: updateError } = await supabase
          .from('user_push_subscriptions')
          .update({
            endpoint: newSubscription.endpoint,
            p256dh: p256dhKey,
            auth: authKey,
          })
          .eq('id', existingData.id);

        if (updateError) {
          console.error('Error updating subscription:', updateError);
          throw updateError;
        }
      } 
      else {
        console.log('Inserting new subscription to database');
        const { error: insertError } = await supabase
          .from('user_push_subscriptions')
          .insert({
            user_id: userId,
            endpoint: newSubscription.endpoint,
            p256dh: p256dhKey,
            auth: authKey,
          });

        if (insertError) {
          console.error('Error inserting subscription:', insertError);
          if (insertError.message && insertError.message.includes('duplicate key')) {
            return { success: false, message: insertError.message };
          }
          throw insertError;
        }
      }
      
      console.log('Subscription saved successfully');
      setSubscription(newSubscription);
      if (userId === initialFamilyMemberId) {
        setIsSubscribed(true);
      }
      
      toast({
        title: "Notifications Enabled",
        description: "You'll receive reminder notifications",
      });
      
      return { success: true, message: "Notifications enabled" };
    } catch (error: any) {
      console.error('Error subscribing to push notifications:', error);
      
      toast({
        title: "Notification Error",
        description: error.message || "Failed to enable notifications. Please try again.",
        variant: "destructive"
      });
      
      return { success: false, message: error.message || "Unknown error" };
    } finally {
      setIsLoading(false);
    }
  }, [registration, initialFamilyMemberId, toast]);

  const unsubscribe = useCallback(async (userId: string): Promise<SubscriptionResponse> => {
    setIsLoading(true);
    try {
      await supabase
        .from('user_push_subscriptions')
        .delete()
        .eq('user_id', userId);
      
      if (userId === initialFamilyMemberId) {
        setIsSubscribed(false);
      }
      
      const { count } = await supabase
        .from('user_push_subscriptions')
        .select('*', { count: 'exact', head: true });
      
      if (count === 0 && subscription) {
        await subscription.unsubscribe();
        setSubscription(null);
      }
      
      toast({
        title: "Notifications Disabled",
        description: "You won't receive reminder notifications",
      });
      
      return { success: true, message: "Notifications disabled" };
    } catch (error: any) {
      console.error('Error unsubscribing from push notifications:', error);
      
      toast({
        title: "Error",
        description: "Failed to disable notifications. Please try again.",
        variant: "destructive"
      });
      
      return { success: false, message: error.message || "Unknown error" };
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
