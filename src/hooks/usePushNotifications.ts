
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getVapidPublicKey } from '@/utils/vapidUtils';

export const usePushNotifications = (familyMemberId: string) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        setRegistration(reg);
        
        // Check if there's an existing subscription for this family member
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('family_member_id', familyMemberId)
          .single();

        if (data) {
          setIsSubscribed(true);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };

    checkSubscription();
  }, [familyMemberId]);

  const subscribe = async () => {
    try {
      if (!registration) {
        throw new Error('Service Worker not ready');
      }

      const publicKey = await getVapidPublicKey();
      if (!publicKey) {
        throw new Error('VAPID public key not available');
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      // Store the subscription specifically for this family member
      const { error } = await supabase.from('push_subscriptions').upsert({
        family_member_id: familyMemberId,
        endpoint: sub.endpoint,
        p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!))),
        auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')!))),
      }, {
        onConflict: 'family_member_id' // Update if exists
      });

      if (error) throw error;

      setSubscription(sub);
      setIsSubscribed(true);
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      throw error;
    }
  };

  const unsubscribe = async () => {
    try {
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove the subscription for this specific family member
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('family_member_id', familyMemberId)
          .eq('endpoint', subscription.endpoint);
        
        setSubscription(null);
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      throw error;
    }
  };

  return {
    isSubscribed,
    subscribe,
    unsubscribe,
  };
};
