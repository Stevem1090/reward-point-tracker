
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "https://esm.sh/web-push@3.6.6";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || "https://ehhycpszdjhdqsorriun.supabase.co";
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting send-push-notification function");
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch VAPID keys from the database
    console.log("Fetching VAPID keys from the database");
    const { data: vapidKeys, error: vapidError } = await supabase
      .from('vapid_keys')
      .select('public_key, private_key')
      .single();

    if (vapidError) {
      console.error('Failed to fetch VAPID keys:', vapidError);
      throw new Error(`Failed to fetch VAPID keys: ${vapidError.message}`);
    }

    if (!vapidKeys || !vapidKeys.public_key || !vapidKeys.private_key) {
      console.error('VAPID keys are missing or incomplete:', vapidKeys);
      throw new Error('VAPID keys are missing or incomplete');
    }

    console.log("VAPID keys retrieved successfully. Public key starts with:", vapidKeys.public_key.substring(0, 10));
    console.log("Public key length:", vapidKeys.public_key.length);
    console.log("Private key length:", vapidKeys.private_key.length);

    // Validate VAPID key format
    try {
      // Attempt to validate key formats before setting them
      if (!/^[A-Za-z0-9_-]+$/.test(vapidKeys.public_key) || 
          !/^[A-Za-z0-9_-]+$/.test(vapidKeys.private_key)) {
        throw new Error('VAPID keys contain invalid characters');
      }
    } catch (validationError) {
      console.error('VAPID key validation error:', validationError);
      throw new Error(`Invalid VAPID key format: ${validationError.message}`);
    }

    // Set up web push with the stored VAPID keys
    try {
      webpush.setVapidDetails(
        'mailto:your-email@example.com',
        vapidKeys.public_key,
        vapidKeys.private_key
      );
      console.log("Web Push configured successfully with VAPID keys");
    } catch (vapidSetupError) {
      console.error('Error setting up Web Push with VAPID keys:', vapidSetupError);
      throw new Error(`Error setting up Web Push: ${vapidSetupError.message}`);
    }

    const requestBody = await req.json();
    const { userId, userIds, familyMemberIds, title, body } = requestBody;
    
    console.log("Request body:", JSON.stringify({
      hasUserId: !!userId,
      hasUserIds: !!userIds && Array.isArray(userIds),
      hasFamilyMemberIds: !!familyMemberIds && Array.isArray(familyMemberIds),
      title,
      bodyLength: body?.length
    }));
    
    // Determine target user IDs to send notifications to
    let targetUserIds: string[] = [];
    
    if (userId) {
      // Single user notification
      targetUserIds = [userId];
      console.log(`Sending push notification to user ${userId}`);
    } else if (userIds && Array.isArray(userIds)) {
      // Multiple users notification
      targetUserIds = userIds;
      console.log(`Sending push notification to ${targetUserIds.length} users`);
    } else if (familyMemberIds && Array.isArray(familyMemberIds)) {
      // If family member IDs are provided instead of user IDs (for backward compatibility)
      targetUserIds = familyMemberIds;
      console.log(`Sending push notification to ${targetUserIds.length} family members`);
    } else {
      return new Response(
        JSON.stringify({ error: 'Either userId, userIds, or familyMemberIds must be provided' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch subscriptions for specific users
    console.log(`Fetching subscriptions for ${targetUserIds.length} users`);
    const { data: subscriptions, error } = await supabase
      .from('user_push_subscriptions')
      .select('*')
      .in('user_id', targetUserIds);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions found for these users');
      return new Response(
        JSON.stringify({ message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions`);

    // Send notification to each subscription
    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        console.log(`Sending to endpoint: ${subscription.endpoint.substring(0, 30)}...`);
        
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        };
        
        await webpush.sendNotification(
          pushSubscription, 
          JSON.stringify({ 
            title, 
            body,
            userId: subscription.user_id 
          })
        );
        
        return { success: true, endpoint: subscription.endpoint, userId: subscription.user_id };
      } catch (error) {
        console.error(`Error sending to ${subscription.endpoint}:`, error);
        
        // Check if the subscription might be expired or invalid
        if (error.statusCode === 404 || error.statusCode === 410) {
          console.log(`Subscription appears to be invalid, removing: ${subscription.endpoint}`);
          try {
            // Remove invalid subscription
            await supabase
              .from('user_push_subscriptions')
              .delete()
              .eq('endpoint', subscription.endpoint);
          } catch (deleteError) {
            console.error('Error removing invalid subscription:', deleteError);
          }
        }
        
        return { 
          success: false, 
          endpoint: subscription.endpoint, 
          userId: subscription.user_id, 
          error: error.message,
          statusCode: error.statusCode
        };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;

    console.log(`Successfully sent ${successCount} of ${results.length} notifications`);

    return new Response(
      JSON.stringify({ 
        message: 'Push notifications processed', 
        total: results.length,
        successful: successCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-push-notification function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send push notification',
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
