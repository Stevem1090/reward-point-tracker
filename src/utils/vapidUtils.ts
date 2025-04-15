
import { supabase } from '@/integrations/supabase/client';

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

// Convert base64 string to Uint8Array for applicationServerKey
export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
