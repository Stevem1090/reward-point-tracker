
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getVapidPublicKey, urlBase64ToUint8Array } from '@/utils/vapidUtils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionResponse } from '@/types/user';

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
      setIsLoading(false);
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
        setIsLoading(false);
        return false;
      }

      // Check if there's an active service worker subscription
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        console.log('No service worker registration found');
        setIsLoading(false);
        return false;
      }

      const existingSub = await reg.pushManager.getSubscription();
      
      // User is considered subscribed if they have both a database entry and an active browser subscription
      const isSubbed = !!(data && existingSub);
      setIsSubscribed(isSubbed);
      setRegistration(reg);
      setSubscription(existingSub);
      setIsLoading(false);
      
      return isSubbed;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setIsLoading(false);
      return false;
    }
  }, [user?.id]);

  useEffect(() => {
    // Don't try to load subscriptions if user is not logged in
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    // Check for browser support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported in this browser');
      setIsLoading(false);
      return;
    }

    // Initialize subscription status
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
    
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast({
        title: "Error",
        description: "Your browser doesn't support push notifications",
        variant: "destructive"
      });
      return { success: false, message: "Browser doesn't support notifications" };
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

      // Check if user profile exists, create if it doesn't
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.log('Creating user profile for:', user.id);
        await supabase
          .from('user_profiles')
          .insert({ id: user.id, name: user.email?.split('@')[0] || null });
      }

      // Save subscription to database
      const { error } = await supabase
        .from('user_push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: newSubscription.endpoint,
          p256dh: p256dhKey,
          auth: authKey,
        }, {
          onConflict: 'user_id, endpoint'
        });

      if (error) {
        console.error('Error saving subscription to database:', error);
        throw error;
      }

      setSubscription(newSubscription);
      setIsSubscribed(true);
      
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
  }, [registration, user, toast]);

  const unsubscribe = useCallback(async (): Promise<SubscriptionResponse> => {
    if (!user?.id) {
      return { success: false, message: "User not logged in" };
    }
    
    setIsLoading(true);
    try {
      // Remove from database
      const { error } = await supabase
        .from('user_push_subscriptions')
        .delete()
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error removing subscription from database:', error);
        throw error;
      }
      
      // Unsubscribe from push manager
      if (subscription) {
        await subscription.unsubscribe();
        setSubscription(null);
      }
      
      setIsSubscribed(false);
      
      toast({
        title: "Notifications Disabled",
        description: "You won't receive reminder notifications",
      });
      
      return { success: true, message: "Notifications disabled" };
    } catch (error: any) {
      console.error('Error unsubscribing from push notifications:', error);
      
      toast({
        title: "Error",
        description: error.message || "Failed to disable notifications. Please try again.",
        variant: "destructive"
      });
      
      return { success: false, message: error.message || "Unknown error" };
    } finally {
      setIsLoading(false);
    }
  }, [subscription, user?.id, toast]);

  return {
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    checkSubscriptionStatus
  };
};
