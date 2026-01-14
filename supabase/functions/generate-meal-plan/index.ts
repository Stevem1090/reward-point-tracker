import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a meal planning assistant for a UK family. Generate a weekly meal plan with one main meal per day (Monday to Sunday).

RULES:
- Suggest varied, family-friendly meals
- Include a mix of cuisines (British, Italian, Asian, Mexican, etc.)
- Consider cooking time - some quick meals for busy weeknights
- Avoid repeating the same protein two days in a row
- For each meal, suggest a URL from a well-known recipe site (BBC Good Food, Delicious Magazine, Jamie Oliver, etc.)
- Mark spicy dishes and note if kid-friendly adjustments are possible

You MUST use the suggest_meals function to return your response.`;

interface MealSuggestion {
  day_of_week: string;
  meal_name: string;
  description: string;
  suggested_url: string;
  url_confidence: "high" | "medium" | "low";
  estimated_cook_minutes: number;
  servings: number;
  is_spicy: boolean;
  kid_friendly_notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { preferences, excludeMeals } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userPrompt = `Generate a meal plan for the week.
${preferences ? `Preferences: ${preferences}` : ""}
${excludeMeals?.length ? `Please avoid these meals we've had recently: ${excludeMeals.join(", ")}` : ""}

Generate 7 meals, one for each day Monday through Sunday.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_meals",
              description: "Return the weekly meal plan with 7 meals",
              parameters: {
                type: "object",
                properties: {
                  meals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        day_of_week: { 
                          type: "string", 
                          enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] 
                        },
                        meal_name: { type: "string" },
                        description: { type: "string" },
                        suggested_url: { type: "string" },
                        url_confidence: { type: "string", enum: ["high", "medium", "low"] },
                        estimated_cook_minutes: { type: "number" },
                        servings: { type: "number" },
                        is_spicy: { type: "boolean" },
                        kid_friendly_notes: { type: "string" },
                      },
                      required: ["day_of_week", "meal_name", "description", "suggested_url", "url_confidence", "estimated_cook_minutes", "servings", "is_spicy"],
                    },
                  },
                },
                required: ["meals"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_meals" } },
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

    const meals: MealSuggestion[] = JSON.parse(toolCall.function.arguments).meals;

    return new Response(
      JSON.stringify({ meals }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating meal plan:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate meal plan" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
