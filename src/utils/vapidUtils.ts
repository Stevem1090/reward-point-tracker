
import * as webpush from 'web-push';
import { supabase } from '@/integrations/supabase/client';

// Generate VAPID keys if they don't exist
export async function ensureVapidKeys() {
  // Get the existing VAPID keys from the database
  const { data: existingKeys, error: fetchError } = await supabase
    .from('vapid_keys')
    .select('public_key, private_key')
    .single();

  if (fetchError) {
    console.error('Error fetching VAPID keys:', fetchError);
    return null;
  }

  // If keys exist and are not empty, return them
  if (existingKeys && existingKeys.public_key && existingKeys.private_key) {
    return {
      publicKey: existingKeys.public_key,
      privateKey: existingKeys.private_key
    };
  }

  // Generate new VAPID keys if none exist
  const vapidKeys = webpush.generateVAPIDKeys();

  // Store the new keys in the database
  const { error: updateError } = await supabase
    .from('vapid_keys')
    .update({
      public_key: vapidKeys.publicKey,
      private_key: vapidKeys.privateKey
    })
    .eq('id', '00000000-0000-0000-0000-000000000000');

  if (updateError) {
    console.error('Error storing VAPID keys:', updateError);
    return null;
  }

  return {
    publicKey: vapidKeys.publicKey,
    privateKey: vapidKeys.privateKey
  };
}

// Function to get the public VAPID key for client-side subscription
export async function getVapidPublicKey() {
  const { data, error } = await supabase
    .from('vapid_keys')
    .select('public_key')
    .single();

  if (error || !data) {
    console.error('Error fetching VAPID public key:', error);
    return null;
  }

  return data.public_key;
}
