
import * as webpush from 'web-push';
import { supabase } from '@/integrations/supabase/client';

// Generate VAPID keys if they don't exist
export async function ensureVapidKeys() {
  // First, check if VAPID keys exist in Supabase secrets
  const { data: existingKeys, error } = await supabase
    .from('push_subscriptions')
    .select('p256dh, auth')
    .maybeSingle();

  if (existingKeys) {
    // Keys already exist in the system
    return null;
  }

  // Generate new VAPID keys
  const vapidKeys = webpush.generateVAPIDKeys();
  
  // In a real-world scenario, you would store these securely
  // For this example, we'll just log them
  console.log('Generated VAPID Public Key:', vapidKeys.publicKey);
  console.log('Generated VAPID Private Key:', vapidKeys.privateKey);

  return {
    publicKey: vapidKeys.publicKey,
    privateKey: vapidKeys.privateKey
  };
}

// Function to get the public VAPID key for client-side subscription
export async function getVapidPublicKey() {
  // In a real app, you'd retrieve this from a secure storage
  const keys = await ensureVapidKeys();
  return keys?.publicKey || null;
}
