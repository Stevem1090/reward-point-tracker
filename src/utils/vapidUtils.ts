
import { supabase } from '@/integrations/supabase/client';

// Function to get the public VAPID key for client-side subscription
export async function getVapidPublicKey() {
  try {
    const { data, error } = await supabase
      .from('vapid_keys')
      .select('public_key')
      .single();

    if (error || !data) {
      console.error('Error fetching VAPID public key:', error);
      return null;
    }

    return data.public_key;
  } catch (error) {
    console.error('Error in getVapidPublicKey:', error);
    return null;
  }
}

// Convert base64 string to Uint8Array for applicationServerKey
export function urlBase64ToUint8Array(base64String: string) {
  try {
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
  } catch (error) {
    console.error('Error in urlBase64ToUint8Array:', error);
    throw error;
  }
}

// Send a push notification to selected family members
export async function sendPushNotification(familyMemberIds: string[], title: string, body: string) {
  try {
    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.supabaseKey}`
      },
      body: JSON.stringify({
        familyMemberIds,
        title,
        body
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to send push notification: ${errorData.error || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}
