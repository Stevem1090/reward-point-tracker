import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a practical meal planning assistant for a UK family.

BALANCE PRINCIPLE:
Aim for roughly 70% familiar, crowd-pleasing meals and 30% slightly more adventurous options.
Families need reliable weeknight dinners, not a culinary adventure every night.

VARIETY GUIDELINES:
- Include 2–3 cuisines across the week + 1 wildcard meal (still family-friendly)
- Avoid repeating the same main protein on consecutive days
- Mix cooking effort: some quick, some more involved
- Across 7 meals: use at least 4 different main proteins and at least 4 different carb bases (e.g. rice, pasta, potatoes, wraps, noodles, couscous/bulgur, bread, low-carb bowl)
- Across 7 meals: use at least 4 cooking methods (traybake, one-pan, oven-bake, simmer/curry, grill, slow-cook, stir-fry, build-your-own)

SLOT TIMING:
- WEEKDAY: Quick, practical meals under 30 mins
- FRIDAY: Treat meal or takeaway-style dish
- WEEKEND: More time for cooking - roast, slow-cook, pie, traybake, etc.

NAMING STYLE:
- Use clear, recognisable dish names families will understand
- Be specific enough to be useful, but not overly elaborate
- Avoid pretentious or restaurant-style naming

AVOID:
- Overly exotic or unfamiliar ingredients
- Complicated techniques for weeknight meals
- Dishes that require hard-to-find ingredients
- Restaurant-style pretentious naming

RECENT MEALS (VERY IMPORTANT):
You will receive a list called recent_meals (meals from recent weekly plans).

HARD CONSTRAINT — DO NOT REPEAT:
- Do not include any meal that is the same as, very similar to, or a clear variant of anything in recent_meals.
- Treat these as repeats (examples):
  - "Spaghetti Bolognese" ≈ "Spag Bol" ≈ "Pasta Bolognese" ≈ "Turkey Bolognese"
  - "Chicken Fajitas" ≈ "Fajita Wraps" ≈ "Sheet-pan Fajitas"
  - "Beef Burgers" ≈ "Cheeseburgers" ≈ "Homemade Burgers"
  - "Chilli con carne" ≈ "Beef chilli" ≈ "Chilli bowls"
  - Curry variants count as repeats if the base is the same (e.g., "Chicken Tikka" ≈ "Chicken Tikka Masala")

NOVELTY TARGET:
- At least 5 of the 7 meals must be clearly different from recent_meals in: (1) core protein, (2) cuisine style, and (3) format (pasta vs traybake vs bowls vs pie etc.).
- Include at least 3 "less common but still UK-family-friendly" meals (recognisable, no hard-to-find ingredients).

TWO-PASS PLANNING (important):
1) Silently generate a candidate pool of 20–25 dinners that fit all rules and avoid recent_meals.
2) Select the final 7 that maximise variety across protein, carb, cuisine, and method.

If constraints conflict, prioritise:
1) Avoid repeats vs recent_meals
2) Keep weekday meals under 30 mins
3) Keep the plan family-friendly and practical

URL INSTRUCTIONS:
- Leave suggested_url as empty string ""
- Set url_confidence to "low"

Use the suggest_meals function to return your response.`;

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

async function fetchRecentMeals(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  // Get meals from the last 4 weeks
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];

  const { data: recentMealPlans, error: plansError } = await supabase
    .from('meal_plans')
    .select('id, week_start_date')
    .gte('week_start_date', fourWeeksAgoStr)
    .order('week_start_date', { ascending: false });

  if (plansError || !recentMealPlans?.length) {
    console.log('No recent meal plans found or error:', plansError);
    return [];
  }

  const planIds = recentMealPlans.map(p => p.id);

  const { data: meals, error: mealsError } = await supabase
    .from('meals')
    .select('meal_name')
    .in('meal_plan_id', planIds);

  if (mealsError) {
    console.error('Error fetching recent meals:', mealsError);
    return [];
  }

  // Return unique meal names
  const mealNames = [...new Set(meals?.map(m => m.meal_name) || [])];
  console.log(`Found ${mealNames.length} unique meals from last 4 weeks:`, mealNames);
  return mealNames;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { preferences, excludeMeals, daysToRegenerate } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch recent meals from database
    let recentMeals: string[] = [];
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      recentMeals = await fetchRecentMeals(supabase);
    }

    // Combine database recent meals with any explicitly excluded meals
    const allExcludedMeals = [...new Set([...recentMeals, ...(excludeMeals || [])])];

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

    // Build the recent meals section for the prompt
    const recentMealsSection = allExcludedMeals.length > 0
      ? `\nrecent_meals (DO NOT REPEAT or use similar variants):\n${allExcludedMeals.map(m => `- ${m}`).join('\n')}\n`
      : '';

    const userPrompt = `Generate exactly ${totalMeals} meals for these slots:
${slotRequests.join("\n")}

${preferences ? `Family preferences: ${preferences}` : ""}
${recentMealsSection}
Remember: Focus on practical, family-friendly meals with good variety. Avoid any meals similar to recent_meals. Tag each meal with its slot_type.`;

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
