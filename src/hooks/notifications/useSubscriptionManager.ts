
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SubscriptionResponse } from '@/types/user';
import { getVapidPublicKey, urlBase64ToUint8Array } from '@/utils/vapidUtils';

export const useSubscriptionManager = () => {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const { toast } = useToast();

  const createSubscription = useCallback(async (): Promise<{ subscription: PushSubscription; keys: { p256dhKey: string; authKey: string } } | null> => {
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

      const existingSub = await (reg as any).pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      const newSubscription = await (reg as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Process subscription keys
      const p256dhRaw = new Uint8Array(newSubscription.getKey('p256dh')!);
      const authRaw = new Uint8Array(newSubscription.getKey('auth')!);
      
      const p256dhKey = btoa(String.fromCharCode.apply(null, Array.from(p256dhRaw)));
      const authKey = btoa(String.fromCharCode.apply(null, Array.from(authRaw)));

      setSubscription(newSubscription);
      return { subscription: newSubscription, keys: { p256dhKey, authKey } };
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      toast({
        title: "Subscription Error",
        description: error.message || "Failed to create subscription",
        variant: "destructive"
      });
      return null;
    }
  }, [registration, toast]);

  const removeSubscription = useCallback(async (): Promise<boolean> => {
    if (subscription) {
      try {
        await subscription.unsubscribe();
        setSubscription(null);
        return true;
      } catch (error) {
        console.error('Error removing subscription:', error);
        return false;
      }
    }
    return true;
  }, [subscription]);

  return {
    registration,
    subscription,
    createSubscription,
    removeSubscription
  };
};
