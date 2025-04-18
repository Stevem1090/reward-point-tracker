
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.info("[START] send-push-notification function triggered");

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const requestBody = await req.json();
    console.debug("[INPUT] Raw request body:", JSON.stringify(requestBody));

    // Extract userIds from request - check all possible properties
    const userIds = requestBody.userIds || 
                   requestBody.familyMemberIds || 
                   (requestBody.userId ? [requestBody.userId] : undefined);
                   
    const { title, body } = requestBody;

    console.debug("[VALIDATION] UserIds extracted:", userIds);

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      console.warn("[VALIDATION] Invalid or missing userIds:", userIds);
      return new Response(
        JSON.stringify({ 
          status: 400,
          message: 'Invalid or missing userIds. Please provide userIds, familyMemberIds, or userId' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.info(`[VALIDATION] Processing push for ${userIds.length} user(s) with title: ${title}`);

    const { data: vapidKeys, error: vapidError } = await supabase
      .from('vapid_keys')
      .select('public_key, private_key')
      .single();

    if (vapidError || !vapidKeys) {
      console.error("[ERROR] Failed to fetch VAPID keys:", vapidError);
      return new Response(
        JSON.stringify({ 
          status: 500,
          message: 'Failed to retrieve VAPID keys' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.info("[SETUP] VAPID keys retrieved. Setting up web-push");
    webpush.setVapidDetails(
      'mailto:admin@familyapp.com',
      vapidKeys.public_key,
      vapidKeys.private_key
    );

    const { data: subscriptions, error: subError } = await supabase
      .from('user_push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (subError) {
      console.error("[ERROR] Failed to fetch subscriptions:", subError);
      return new Response(
        JSON.stringify({ 
          status: 500,
          message: 'Failed to fetch user subscriptions' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.warn("[INFO] No subscriptions found for provided user IDs");
      return new Response(
        JSON.stringify({ 
          status: 200,
          message: 'No subscriptions found for the given users' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.info(`[SEND] Sending notifications to ${subscriptions.length} subscription(s)`);

    const sendResults = await Promise.all(subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        const payload = JSON.stringify({
          title,
          body,
          userId: sub.user_id
        });

        await webpush.sendNotification(pushSubscription, payload);

        console.info(`[SUCCESS] Notification sent to user ${sub.user_id}`);
        return { success: true, userId: sub.user_id };

      } catch (error) {
        console.error(`[FAILURE] Error sending to ${sub.endpoint}:`, error);

        if (error.statusCode === 404 || error.statusCode === 410) {
          console.warn(`[CLEANUP] Removing stale subscription for ${sub.user_id}`);
          await supabase
            .from('user_push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }

        return { 
          success: false, 
          userId: sub.user_id, 
          error: error.message 
        };
      }
    }));

    const successCount = sendResults.filter(r => r.success).length;

    console.info(`[COMPLETE] ${successCount}/${sendResults.length} notifications sent successfully.`);

    return new Response(
      JSON.stringify({ 
        status: 200,
        message: 'Push notifications processed', 
        total: sendResults.length,
        successful: successCount,
        results: sendResults 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[UNHANDLED] Error in push function:", error);
    return new Response(
      JSON.stringify({ 
        status: 500,
        message: 'Unexpected error processing push notifications',
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
