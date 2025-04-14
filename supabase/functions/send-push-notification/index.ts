
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "https://esm.sh/web-push@3.6.6";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      "https://ehhycpszdjhdqsorriun.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaHljcHN6ZGpoZHFzb3JyaXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMzQwNzQsImV4cCI6MjA1OTgxMDA3NH0.UH3VJFRZMPJC7WNsJtPf6wJrfp1KwuppoKkGHS9uSJQ"
    );

    const { reminder_id, owner_ids } = await req.json();

    // Get reminder details
    const { data: reminder } = await supabaseClient
      .from('events')
      .select('title, description')
      .eq('id', reminder_id)
      .single();

    if (!reminder) {
      throw new Error('Reminder not found');
    }

    // Get push subscriptions for all owners
    const { data: subscriptions } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .in('family_member_id', owner_ids);

    if (!subscriptions?.length) {
      console.log('No subscriptions found for owners');
      return new Response(
        JSON.stringify({ message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send push notification to each subscription
    const results = await Promise.allSettled(
      subscriptions.map(sub => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        return webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: reminder.title,
            body: reminder.description || 'Time for your reminder!',
          })
        );
      })
    );

    console.log('Push notification results:', results);

    return new Response(
      JSON.stringify({ message: 'Notifications sent', results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending push notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
