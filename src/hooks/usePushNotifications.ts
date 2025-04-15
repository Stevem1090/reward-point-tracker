
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

  // Check if a specific family member is subscribed
  const checkSubscriptionStatus = useCallback(async (familyMemberId: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported in this browser');
      return false;
    }

    try {
      // Check for existing subscription in the database
      const { data } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('family_member_id', familyMemberId)
        .maybeSingle();

      // Check if service worker is registered
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return false;

      // Check if there's an active push subscription
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
      // Ensure service worker is registered and ready
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

      // Unsubscribe from any existing subscription first to ensure clean state
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      // Create a new subscription
      const newSubscription = await reg.pushManager.subscribe({
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
        description: "Failed to enable notifications. Please try again.",
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
      // Remove from database first
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('family_member_id', familyMemberId);
      
      if (familyMemberId === initialFamilyMemberId) {
        setIsSubscribed(false);
      }
      
      // Only unsubscribe from push manager if we're unsubscribing the last family member
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
