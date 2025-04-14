
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "https://esm.sh/web-push@3.6.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Replace these with your actual VAPID keys
const VAPID_PUBLIC_KEY = "YOUR_VAPID_PUBLIC_KEY";
const VAPID_PRIVATE_KEY = "YOUR_VAPID_PRIVATE_KEY";

webpush.setVapidDetails(
  'mailto:your-email@example.com', 
  VAPID_PUBLIC_KEY, 
  VAPID_PRIVATE_KEY
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
