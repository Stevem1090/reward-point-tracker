
import { supabase } from '@/integrations/supabase/client';

// Function to get the public VAPID key for client-side subscription
export async function getVapidPublicKey() {
  try {
    console.log('Fetching VAPID public key');
    const { data, error } = await supabase
      .from('vapid_keys')
      .select('public_key')
      .single();

    if (error) {
      console.error('Error fetching VAPID public key:', error);
      return null;
    }

    if (!data || !data.public_key) {
      console.error('VAPID public key is missing or invalid in database');
      return null;
    }

    console.log('Successfully retrieved VAPID public key');
    return data.public_key;
  } catch (error) {
    console.error('Exception in getVapidPublicKey:', error);
    return null;
  }
}

// Convert base64 string to Uint8Array for applicationServerKey
export function urlBase64ToUint8Array(base64String: string) {
  try {
    // Ensure padding is correct
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // Decode base64
    const rawData = atob(base64);
    
    // Convert to Uint8Array
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (error) {
    console.error('Error in urlBase64ToUint8Array:', error);
    throw new Error(`Failed to process VAPID key: ${error.message}. Key might be in invalid format.`);
  }
}

// Send a push notification to selected family members
export async function sendPushNotification(familyMemberIds: string[], title: string, body: string) {
  try {
    console.log(`Sending push notification to ${familyMemberIds.length} recipients`);
    
    // Use supabase.functions.invoke instead of direct URL access
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        familyMemberIds,
        title,
        body
      }
    });

    if (error) {
      console.error('Error invoking send-push-notification function:', error);
      throw new Error(`Failed to send push notification: ${error.message}`);
    }

    console.log('Push notification response:', data);
    return data;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}
