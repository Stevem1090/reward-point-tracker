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
    if (!user?.id) {
      console.log('User not logged in, cannot check subscription status');
      setIsLoading(false);
      return false;
    }
    
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported in this browser');
      setIsLoading(false);
      return false;
    }

    try {
      console.log('Checking subscription status for user:', user.id);
      
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

      console.log('Database subscription check result:', data ? 'Found' : 'Not found');

      // Check if there's an active service worker subscription
      let reg: ServiceWorkerRegistration | null = null;
      try {
        reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          console.log('No service worker registration found');
        } else {
          console.log('Service worker registration found');
        }
      } catch (swError) {
        console.error('Error getting service worker registration:', swError);
      }
      
      let existingSub: PushSubscription | null = null;
      if (reg) {
        try {
          existingSub = await reg.pushManager.getSubscription();
          console.log('Push subscription:', existingSub ? 'Found' : 'Not found');
        } catch (pushError) {
          console.error('Error getting push subscription:', pushError);
        }
      }
      
      // User is considered subscribed if they have both a database entry and an active browser subscription
      const isSubbed = !!(data && existingSub);
      console.log('Is user subscribed:', isSubbed);
      
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
      console.log('User not logged in, skipping subscription check');
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
      console.log('Cannot subscribe: User not logged in');
      toast({
        title: "Error",
        description: "You must be logged in to enable notifications",
        variant: "destructive"
      });
      return { success: false, message: "User not logged in" };
    }
    
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Cannot subscribe: Browser does not support push notifications');
      toast({
        title: "Error",
        description: "Your browser doesn't support push notifications",
        variant: "destructive"
      });
      return { success: false, message: "Browser doesn't support notifications" };
    }
    
    setIsLoading(true);
    try {
      console.log('Starting subscription process');
      
      // Get or register service worker
      let reg = registration;
      if (!reg) {
        console.log('Registering service worker');
        try {
          reg = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
          console.log('Service worker registered successfully');
          setRegistration(reg);
        } catch (swError) {
          console.error('Error registering service worker:', swError);
          throw new Error(`Failed to register service worker: ${swError.message}`);
        }
      }
      
      // Get VAPID public key
      console.log('Fetching VAPID public key');
      const publicKey = await getVapidPublicKey();
      if (!publicKey) {
        console.error('Failed to get VAPID public key');
        throw new Error('VAPID public key not available');
      }
      console.log('VAPID public key retrieved successfully');

      // Check if user profile exists before proceeding - but don't create one
      console.log('Checking if user profile exists');
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error checking user profile:', profileError);
      }

      if (!profile) {
        console.log('User profile not found. Profile should be created during signup.');
        // We no longer attempt to create a profile here - this should happen during signup
      } else {
        console.log('User profile exists');
      }

      // Unsubscribe from any existing subscription
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        console.log('Unsubscribing from existing subscription');
        await existingSub.unsubscribe();
        console.log('Unsubscribed from existing subscription');
      }

      // Create new subscription
      console.log('Creating new push subscription');
      let newSubscription: PushSubscription;
      try {
        newSubscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        console.log('Push subscription created successfully');
      } catch (subscribeError) {
        console.error('Error creating push subscription:', subscribeError);
        throw new Error(`Failed to subscribe to push notifications: ${subscribeError.message}`);
      }

      // Convert keys to base64
      console.log('Processing subscription keys');
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

      // Replace the upsert operation with a check-then-update-or-insert approach
      // First, check if a subscription for this user already exists
      console.log('Checking for existing subscription in database');
      const { data: existingData } = await supabase
        .from('user_push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('endpoint', newSubscription.endpoint)
        .maybeSingle();

      // If it exists, update it
      if (existingData?.id) {
        console.log('Updating existing subscription in database');
        const { error: updateError } = await supabase
          .from('user_push_subscriptions')
          .update({
            p256dh: p256dhKey,
            auth: authKey,
          })
          .eq('id', existingData.id);

        if (updateError) {
          console.error('Error updating subscription:', updateError);
          throw updateError;
        }
      } 
      // Otherwise, insert a new one
      else {
        console.log('Inserting new subscription to database');
        const { error: insertError } = await supabase
          .from('user_push_subscriptions')
          .insert({
            user_id: user.id,
            endpoint: newSubscription.endpoint,
            p256dh: p256dhKey,
            auth: authKey,
          });

        if (insertError) {
          console.error('Error inserting subscription:', insertError);
          throw insertError;
        }
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
      console.log('Cannot unsubscribe: User not logged in');
      return { success: false, message: "User not logged in" };
    }
    
    setIsLoading(true);
    try {
      console.log('Starting unsubscribe process');
      
      // Remove from database
      console.log('Removing subscription from database');
      const { error } = await supabase
        .from('user_push_subscriptions')
        .delete()
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error removing subscription from database:', error);
        throw error;
      }
      console.log('Subscription removed from database successfully');
      
      // Unsubscribe from push manager
      if (subscription) {
        console.log('Unsubscribing from push manager');
        try {
          await subscription.unsubscribe();
          console.log('Unsubscribed from push manager successfully');
        } catch (unsubError) {
          console.error('Error unsubscribing from push manager:', unsubError);
          // Continue anyway as we've already removed from database
        }
        setSubscription(null);
      } else {
        console.log('No active subscription to unsubscribe from');
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
