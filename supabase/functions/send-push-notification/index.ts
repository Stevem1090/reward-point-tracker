
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.6";
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

    // Validate input
    const requestBody = await req.json();
    const { userIds, title, body } = requestBody;

    // Validate required fields
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing userIds' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch VAPID keys from the database
    const { data: vapidKeys, error: vapidError } = await supabase
      .from('vapid_keys')
      .select('public_key, private_key')
      .single();

    if (vapidError || !vapidKeys) {
      console.error('Failed to fetch VAPID keys:', vapidError);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve VAPID keys' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Set up web push with the stored VAPID keys
    webpush.setVapidDetails(
      'mailto:admin@familyapp.com',
      vapidKeys.public_key,
      vapidKeys.private_key
    );

    // Fetch subscriptions for specific users
    const { data: subscriptions, error } = await supabase
      .from('user_push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user subscriptions' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions found for the given users' }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Send notification to each subscription
    const sendPromises = subscriptions.map(async (subscription) => {
      try {
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
        
        return { 
          success: true, 
          userId: subscription.user_id 
        };
      } catch (error) {
        console.error(`Error sending to ${subscription.endpoint}:`, error);
        
        // If subscription is invalid, remove it
        if (error.statusCode === 404 || error.statusCode === 410) {
          await supabase
            .from('user_push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint);
        }
        
        return { 
          success: false, 
          userId: subscription.user_id, 
          error: error.message 
        };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({ 
        message: 'Push notifications processed', 
        total: results.length,
        successful: successCount,
        results 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Unhandled error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Unexpected error processing push notifications',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
