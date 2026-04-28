import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Ingredient {
  quantity?: string;
  unit?: string;
  name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ingredients, servings, mealName, recipeCardId } = await req.json();

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return new Response(JSON.stringify({ error: "Ingredients required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const ingredientsList = (ingredients as Ingredient[])
      .map(i => `- ${i.quantity || ""} ${i.unit || ""} ${i.name}`.trim())
      .join("\n");

    const prompt = `Recipe: ${mealName || "Unknown dish"}
Total servings: ${servings || 4}

Ingredients:
${ingredientsList}

Estimate the calories per single serving. Be a sensible UK home-cooking average. Round to the nearest 10.`;

    const aiRequestBody = JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: "You are a nutrition estimator. Given an ingredient list and serving count, return a realistic estimated calories per single serving as an integer. Be sensible and pragmatic — avoid extremes.",
        },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "estimate_calories",
            description: "Return the estimated calories per single serving.",
            parameters: {
              type: "object",
              properties: {
                calories_per_serving: {
                  type: "number",
                  description: "Estimated kcal per single serving, rounded to nearest 10.",
                },
                confidence: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                },
              },
              required: ["calories_per_serving", "confidence"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "estimate_calories" } },
    });

    // Retry transient gateway failures (502/503/504, network errors).
    // Do NOT retry 429 (rate limit) or 402 (credits) — those are terminal.
    const RETRY_DELAYS_MS = [500, 1500];
    let aiResp: Response | null = null;
    let lastErr: unknown = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: aiRequestBody,
        });

        if (aiResp.ok) break;

        // Terminal statuses — don't retry
        if (aiResp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResp.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Retry only on 5xx
        if (aiResp.status >= 500 && attempt < RETRY_DELAYS_MS.length) {
          console.warn(`AI gateway ${aiResp.status} (attempt ${attempt + 1}), retrying in ${RETRY_DELAYS_MS[attempt]}ms`);
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          continue;
        }

        // Non-retryable or out of attempts
        const t = await aiResp.text();
        console.error("AI gateway error:", aiResp.status, t.slice(0, 500));
        throw new Error(`AI gateway error: ${aiResp.status}`);
      } catch (err) {
        lastErr = err;
        if (attempt < RETRY_DELAYS_MS.length) {
          console.warn(`AI gateway network error (attempt ${attempt + 1}), retrying:`, err);
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          continue;
        }
        throw err;
      }
    }

    if (!aiResp || !aiResp.ok) {
      throw lastErr ?? new Error("AI gateway failed after retries");
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response");
    }
    const parsed = JSON.parse(toolCall.function.arguments);
    const calories = Math.round((parsed.calories_per_serving || 0) / 10) * 10;

    // If a recipeCardId was provided, update the row server-side (RLS via user JWT)
    if (recipeCardId && calories > 0) {
      const { error: updateError } = await supabase
        .from("recipe_cards")
        .update({ estimated_calories_per_serving: calories })
        .eq("id", recipeCardId);
      if (updateError) {
        console.error("Failed to persist calories:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        calories_per_serving: calories,
        confidence: parsed.confidence || "low",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("estimate-calories error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
