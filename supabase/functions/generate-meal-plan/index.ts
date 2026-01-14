import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a practical meal planning assistant for a UK family.

BALANCE PRINCIPLE:
Aim for roughly 70% familiar, crowd-pleasing meals and 30% slightly more adventurous options. 
Families need reliable weeknight dinners, not a culinary adventure every night.

VARIETY GUIDELINES:
- Include 2-3 different cuisines across the week (not 4+)
- Avoid repeating the same main protein on consecutive days
- Mix cooking effort: some quick, some more involved

CUISINE OPTIONS (use a sensible mix):
British, Italian, Mexican, Chinese, Indian, American, Mediterranean

SLOT TIMING:
- WEEKDAY: Quick, practical meals under 30 mins - focus on family favourites
- FRIDAY: Can be a treat meal or takeaway-style dish
- WEEKEND: More time for cooking - could be a roast, slow-cook, or something slightly different

NAMING STYLE:
- Use clear, recognisable dish names families will understand
- Be specific enough to be useful, but not overly elaborate
- Avoid pretentious or restaurant-style naming

GOOD EXAMPLES (balanced, practical):
- "Chicken Fajitas with Peppers and Onions"
- "Spaghetti Bolognese"
- "Salmon Teriyaki with Rice and Broccoli"
- "Shepherd's Pie"
- "Thai Green Chicken Curry"
- "Homemade Beef Burgers with Chips"
- "Lemon Herb Roast Chicken" (weekend)

AVOID:
- Overly exotic or unfamiliar ingredients
- Complicated techniques for weeknight meals
- Dishes that require hard-to-find ingredients
- Restaurant-style pretentious naming

URL INSTRUCTIONS:
- Leave suggested_url as empty string ""
- Set url_confidence to "low"

You MUST use the suggest_meals function to return your response.`;

type SlotType = "WEEKDAY" | "FRIDAY" | "WEEKEND";

interface MealSuggestion {
  slot_type: SlotType;
  meal_name: string;
  description: string;
  suggested_url: string;
  url_confidence: "high" | "medium" | "low";
  estimated_cook_minutes: number;
  servings: number;
  is_spicy: boolean;
  kid_friendly_notes?: string;
}

function getSlotType(day: string): SlotType {
  if (["Saturday", "Sunday"].includes(day)) return "WEEKEND";
  if (day === "Friday") return "FRIDAY";
  return "WEEKDAY";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { preferences, excludeMeals, daysToRegenerate } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Determine which days to generate
    const allDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const daysToGenerate: string[] = daysToRegenerate?.length > 0 ? daysToRegenerate : allDays;
    
    // Map days to abstract slot types (AI doesn't see actual day names)
    const daySlotMapping = daysToGenerate.map(day => ({
      day,
      slotType: getSlotType(day)
    }));

    // Count slots needed by type
    const slotCounts = {
      WEEKDAY: daySlotMapping.filter(d => d.slotType === "WEEKDAY").length,
      FRIDAY: daySlotMapping.filter(d => d.slotType === "FRIDAY").length,
      WEEKEND: daySlotMapping.filter(d => d.slotType === "WEEKEND").length,
    };

    const totalMeals = daysToGenerate.length;

    // Build user prompt with slot types instead of day names
    const slotRequests = [];
    if (slotCounts.WEEKDAY > 0) {
      slotRequests.push(`- ${slotCounts.WEEKDAY} WEEKDAY meal${slotCounts.WEEKDAY > 1 ? 's' : ''} (quick, under 30 mins active cooking)`);
    }
    if (slotCounts.FRIDAY > 0) {
      slotRequests.push(`- ${slotCounts.FRIDAY} FRIDAY meal${slotCounts.FRIDAY > 1 ? 's' : ''} (can be more indulgent, up to 45 mins)`);
    }
    if (slotCounts.WEEKEND > 0) {
      slotRequests.push(`- ${slotCounts.WEEKEND} WEEKEND meal${slotCounts.WEEKEND > 1 ? 's' : ''} (relaxed cooking, can be 60+ mins)`);
    }

    const userPrompt = `Generate exactly ${totalMeals} meals for these slots:
${slotRequests.join("\n")}

${preferences ? `Family preferences: ${preferences}` : ""}
${excludeMeals?.length ? `Please avoid these meals we've had recently: ${excludeMeals.join(", ")}` : ""}

Remember: Focus on practical, family-friendly meals. Include some variety but prioritise reliability. Tag each meal with its slot_type.`;

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
              name: "suggest_meals",
              description: "Return the meal suggestions for the specified slots",
              parameters: {
                type: "object",
                properties: {
                  meals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        slot_type: { 
                          type: "string", 
                          enum: ["WEEKDAY", "FRIDAY", "WEEKEND"]
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
                      required: ["slot_type", "meal_name", "description", "suggested_url", "url_confidence", "estimated_cook_minutes", "servings", "is_spicy"],
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

    const aiMeals: MealSuggestion[] = JSON.parse(toolCall.function.arguments).meals;

    // Map AI meals (by slot_type) back to actual days
    const slotQueues: Record<SlotType, MealSuggestion[]> = {
      WEEKDAY: aiMeals.filter(m => m.slot_type === "WEEKDAY"),
      FRIDAY: aiMeals.filter(m => m.slot_type === "FRIDAY"),
      WEEKEND: aiMeals.filter(m => m.slot_type === "WEEKEND"),
    };

    const slotIndices: Record<SlotType, number> = { WEEKDAY: 0, FRIDAY: 0, WEEKEND: 0 };

    const mappedMeals = daySlotMapping.map(({ day, slotType }) => {
      const queue = slotQueues[slotType];
      const index = slotIndices[slotType];
      slotIndices[slotType]++;
      
      const meal = queue[index];
      if (!meal) {
        // Fallback if AI didn't return enough meals for this slot type
        console.warn(`Missing meal for ${slotType} slot, day ${day}`);
        return {
          day_of_week: day,
          meal_name: "Meal suggestion unavailable",
          description: "Please regenerate or add manually",
          suggested_url: "",
          url_confidence: "low" as const,
          estimated_cook_minutes: 30,
          servings: 4,
          is_spicy: false,
        };
      }

      return {
        day_of_week: day,
        meal_name: meal.meal_name,
        description: meal.description,
        suggested_url: meal.suggested_url,
        url_confidence: meal.url_confidence,
        estimated_cook_minutes: meal.estimated_cook_minutes,
        servings: meal.servings,
        is_spicy: meal.is_spicy,
        kid_friendly_notes: meal.kid_friendly_notes,
      };
    });

    return new Response(
      JSON.stringify({ meals: mappedMeals }),
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
