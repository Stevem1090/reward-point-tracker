
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

    // Log the key format to help with debugging
    console.log('VAPID public key format check:', {
      keyLength: data.public_key.length,
      startsWithDashes: data.public_key.includes('-'),
      startsWithUnderscores: data.public_key.includes('_'),
      base64Format: /^[A-Za-z0-9+/=_-]+$/.test(data.public_key)
    });

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
    // Validate the input
    if (!base64String || typeof base64String !== 'string') {
      console.error('Invalid VAPID key format:', base64String);
      throw new Error('Invalid VAPID key format');
    }

    console.log('Processing VAPID key:', {
      keyLength: base64String.length,
      keyStart: base64String.substring(0, 10) + '...',
      containsDashes: base64String.includes('-'),
      containsUnderscores: base64String.includes('_')
    });

    // Ensure padding is correct - this is crucial for proper base64 decoding
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    console.log('Processed base64 string length:', base64.length);

    // Decode base64
    try {
      const rawData = atob(base64);
      console.log('Successfully decoded base64, raw data length:', rawData.length);
      
      // Convert to Uint8Array
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      console.log('Successfully created Uint8Array, length:', outputArray.length);
      return outputArray;
    } catch (decodeError) {
      console.error('Base64 decoding error:', decodeError);
      throw new Error(`Failed to decode VAPID key: ${decodeError.message}`);
    }
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
