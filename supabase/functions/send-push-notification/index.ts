
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "https://esm.sh/web-push@3.6.6";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = "https://ehhycpszdjhdqsorriun.supabase.co";
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
      throw new Error('Failed to fetch VAPID keys');
    }

    // Set up web push with the stored VAPID keys
    webpush.setVapidDetails(
      'mailto:your-email@example.com',
      vapidKeys.public_key,
      vapidKeys.private_key
    );

    const { subscription, title, body } = await req.json();

    await webpush.sendNotification(subscription, JSON.stringify({
      title,
      body
    }));

    return new Response(
      JSON.stringify({ message: 'Push notification sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending push notification:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send push notification' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
