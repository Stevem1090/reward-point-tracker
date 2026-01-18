import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a recipe extraction assistant. Extract recipe details from the provided HTML content.

STEP RULES (CRITICAL):
- Extract ALL steps from the recipe - do not skip any
- Use the EXACT wording from the recipe - do not paraphrase or rewrite
- If the recipe has more than 8 steps, combine ONLY where it makes logical sense (e.g., two very short related actions)
- Never drop important cooking instructions to meet a step limit
- Preserve cooking times, temperatures, and techniques exactly as written
- If steps are numbered in the original, respect that structure
- Keep step instructions clear and actionable

INGREDIENT RULES (CRITICAL):
- Extract ingredients EXACTLY as listed in the recipe
- Do NOT add, remove, or substitute any ingredients
- Convert measurements to UK metrics only (grams, ml, etc.)
- Format: { "quantity": "200", "unit": "g", "name": "chicken breast" }

You MUST use the extract_recipe function to return your response.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, mealName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch the webpage content
    let htmlContent = "";
    try {
      const pageResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RecipeBot/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      
      if (pageResponse.ok) {
        htmlContent = await pageResponse.text();
        // Clean HTML - remove scripts, styles, and limit size
        htmlContent = htmlContent
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
          .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 15000); // Limit content size
      }
    } catch (fetchError) {
      console.log("Could not fetch URL:", fetchError);
    }

    // If we couldn't fetch any HTML content, return extraction failure
    if (!htmlContent) {
      console.log("Could not fetch URL content - returning extraction failure");
      return new Response(
        JSON.stringify({ 
          extraction_failed: true,
          sourceUrl: url,
          error: "Unable to access recipe content from this URL"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Extract the recipe for "${mealName}" from this webpage content:\n\n${htmlContent}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_recipe",
              description: "Return the extracted recipe details",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  servings: { type: "number" },
                  estimated_cook_minutes: { type: "number" },
                  ingredients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        quantity: { type: "string" },
                        unit: { type: "string" },
                        name: { type: "string" },
                      },
                      required: ["quantity", "unit", "name"],
                    },
                  },
                  steps: {
                    type: "array",
                    items: { type: "string" },
                  },
                  image_url: { type: "string" },
                },
                required: ["name", "description", "servings", "ingredients", "steps"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_recipe" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid response from AI");
    }

    const recipe = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ recipe, sourceUrl: url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error extracting recipe:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to extract recipe" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
