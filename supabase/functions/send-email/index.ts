
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Resend } from "npm:resend@1.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  email: string;
  subject: string;
  content: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, subject, content }: EmailRequest = await req.json();

    if (!email || !subject || !content) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Extract domain for logging purposes
    const domain = email.split('@')[1]?.toLowerCase();
    
    console.log(`Attempting to send email to ${email} (domain: ${domain})`);
    console.log(`Subject: ${subject}`);
    console.log(`Content length: ${content.length} characters`);

    // Add this log to help debug the source of the request (client or server)
    const isServerRequest = req.headers.get("X-Source") === "server";
    console.log(`Request source: ${isServerRequest ? "Server-side schedule" : "Client-side action"}`);

    // Add domain-specific debugging for problematic providers
    if (domain === 'hotmail.com' || domain === 'outlook.com' || domain === 'live.com') {
      console.log(`Sending to Microsoft email provider (${domain}). Ensuring proper headers and formatting.`);
    }

    // Send email with improved error handling
    try {
      const emailResponse = await resend.emails.send({
        from: "Reward Points <onboarding@resend.dev>",
        to: [email],
        subject: subject,
        html: content,
      });

      console.log("Email send response:", JSON.stringify(emailResponse));

      return new Response(JSON.stringify(emailResponse), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (emailError) {
      console.error(`Error from Resend service for ${domain}:`, emailError);
      return new Response(
        JSON.stringify({ 
          error: emailError.message,
          provider: domain,
          details: emailError 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  } catch (error) {
    console.error("Error in send-email edge function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
