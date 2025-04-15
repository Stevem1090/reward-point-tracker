
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
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch VAPID keys from the database
    const { data: vapidKeys, error: vapidError } = await supabase
      .from('vapid_keys')
      .select('public_key, private_key')
      .single();

    if (vapidError || !vapidKeys) {
      console.error('Failed to fetch VAPID keys:', vapidError);
      throw new Error('Failed to fetch VAPID keys');
    }

    // Set up web push with the stored VAPID keys
    webpush.setVapidDetails(
      'mailto:your-email@example.com',
      vapidKeys.public_key,
      vapidKeys.private_key
    );

    const { userId, userIds, title, body } = await req.json();
    
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
    } else {
      return new Response(
        JSON.stringify({ error: 'Either userId or userIds must be provided' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch subscriptions for specific users
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
        return { success: false, endpoint: subscription.endpoint, userId: subscription.user_id, error: error.message };
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
      JSON.stringify({ error: error.message || 'Failed to send push notification' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
