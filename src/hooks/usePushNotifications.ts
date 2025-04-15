
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getVapidPublicKey, urlBase64ToUint8Array } from '@/utils/vapidUtils';
import { useToast } from '@/hooks/use-toast';

export const usePushNotifications = (familyMemberId: string) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkSubscription = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported in this browser');
        setIsLoading(false);
        return;
      }

      try {
        // Check if service worker is registered and ready
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          console.log('Service worker not registered yet');
          setIsLoading(false);
          return;
        }
        
        setRegistration(registration);
        
        // Check for existing subscription in Push Manager
        const existingSubscription = await registration.pushManager.getSubscription();
        setSubscription(existingSubscription);
        
        // Check if there's a record in the database for this family member
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('family_member_id', familyMemberId)
          .maybeSingle();

        if (data && existingSubscription) {
          setIsSubscribed(true);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, [familyMemberId]);

  const subscribe = async () => {
    setIsLoading(true);
    try {
      // Ensure service worker is registered and ready
      if (!registration) {
        const newRegistration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        setRegistration(newRegistration);
      }
      
      const publicKey = await getVapidPublicKey();
      if (!publicKey) {
        throw new Error('VAPID public key not available');
      }

      // Unsubscribe from any existing subscription first
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      // Create a new subscription
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Extract keys and convert to base64
      const p256dhKey = btoa(
        String.fromCharCode.apply(null, Array.from(new Uint8Array(newSubscription.getKey('p256dh')!)))
      );
      
      const authKey = btoa(
        String.fromCharCode.apply(null, Array.from(new Uint8Array(newSubscription.getKey('auth')!)))
      );

      // Store the subscription in Supabase
      const { error } = await supabase.from('push_subscriptions').upsert({
        family_member_id: familyMemberId,
        endpoint: newSubscription.endpoint,
        p256dh: p256dhKey,
        auth: authKey,
      }, {
        onConflict: 'family_member_id'
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
  };

  const unsubscribe = async () => {
    setIsLoading(true);
    try {
      // Unsubscribe from push manager
      if (subscription) {
        await subscription.unsubscribe();
      }
      
      // Remove from database
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('family_member_id', familyMemberId);
      
      setSubscription(null);
      setIsSubscribed(false);
      
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
  };

  return {
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
};
