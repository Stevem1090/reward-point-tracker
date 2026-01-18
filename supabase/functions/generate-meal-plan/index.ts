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

CURRENT WEEK MEALS (CRITICAL):
You may also receive a list called current_week_meals (already approved for this week).
These are ABSOLUTE EXCLUSIONS - do not suggest anything identical or very similar.
Unlike recent_meals (strong avoidance), current_week_meals must NEVER be duplicated.

FAMILY RATINGS FEEDBACK (IMPORTANT):
You may receive ratings_context with past meal ratings (1-5 stars) and notes.
- FAVOR: Meals similar to 4-5 star rated dishes (same cuisine, protein style, or cooking method)
- AVOID: Meals similar to 1-2 star rated dishes - the family didn't enjoy these
- CONSIDER NOTES: User notes explain WHY they liked/disliked meals (e.g., "too spicy", "kids loved it")
- Use this feedback to personalize suggestions without repeating exact meals

TWO-PASS PLANNING (important):
1) Silently generate a candidate pool of 20–25 dinners that fit all rules, exclude current_week_meals, and avoid recent_meals.
2) Select the final meals that maximise variety across protein, carb, cuisine, and method, while favoring highly-rated meal styles.

If constraints conflict, prioritise:
1) Never duplicate current_week_meals
2) Avoid repeats vs recent_meals
3) Favor highly-rated meal styles, avoid low-rated styles
4) Keep weekday meals under 30 mins
5) Keep the plan family-friendly and practical

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

interface RatingContext {
  meal_name: string;
  rating: number;
  notes: string | null;
}

async function fetchRatingsContext(supabase: ReturnType<typeof createClient>): Promise<RatingContext[]> {
  // Fetch meal ratings with meal names (last 50 ratings)
  const { data: ratings, error } = await supabase
    .from('meal_ratings')
    .select('rating, notes, meal_id')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !ratings?.length) {
    console.log('No ratings found or error:', error);
    return [];
  }

  // Fetch meal names for these ratings
  const mealIds = ratings.map(r => r.meal_id);
  const { data: meals, error: mealsError } = await supabase
    .from('meals')
    .select('id, meal_name')
    .in('id', mealIds);

  if (mealsError || !meals?.length) {
    console.log('Could not fetch meal names for ratings:', mealsError);
    return [];
  }

  // Create a map of meal_id to meal_name
  const mealNameMap = new Map<string, string>();
  meals.forEach(m => mealNameMap.set(m.id, m.meal_name));

  // Build ratings context with meal names
  const ratingsContext: RatingContext[] = ratings
    .filter(r => mealNameMap.has(r.meal_id))
    .map(r => ({
      meal_name: mealNameMap.get(r.meal_id)!,
      rating: r.rating,
      notes: r.notes
    }));

  console.log(`Found ${ratingsContext.length} ratings for context`);
  return ratingsContext;
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

    // Fetch recent meals and ratings from database
    let recentMeals: string[] = [];
    let ratingsContext: RatingContext[] = [];
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      [recentMeals, ratingsContext] = await Promise.all([
        fetchRecentMeals(supabase),
        fetchRatingsContext(supabase)
      ]);
    }

    // Note: excludeMeals contains current week's approved meals (absolute exclusion)
    // recentMeals contains historical meals from last 4 weeks (strong avoidance)

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

    // Build the current week exclusions (passed from frontend - absolute exclusion)
    const currentWeekMeals = excludeMeals || [];
    const currentWeekSection = currentWeekMeals.length > 0
      ? `\ncurrent_week_meals (ABSOLUTE EXCLUSION - already in this week's plan):\n${currentWeekMeals.map(m => `- ${m}`).join('\n')}\n`
      : '';

    // Build the recent meals section (from database, excluding current week to avoid duplication)
    const historicalMeals = recentMeals.filter(m => !currentWeekMeals.includes(m));
    const recentMealsSection = historicalMeals.length > 0
      ? `\nrecent_meals (avoid repeats from past 4 weeks):\n${historicalMeals.map(m => `- ${m}`).join('\n')}\n`
      : '';

    // Build ratings context section
    const ratingsSection = ratingsContext.length > 0
      ? `\nratings_context (family feedback on past meals):\n${ratingsContext.map(r => {
          const stars = '⭐'.repeat(r.rating);
          const noteText = r.notes ? ` - "${r.notes}"` : '';
          return `- ${r.meal_name}: ${stars}${noteText}`;
        }).join('\n')}\n`
      : '';

    // Adjust variety guidance for partial regeneration
    const varietyNote = totalMeals < 7 
      ? `\nIMPORTANT: You are generating ${totalMeals} replacement meal${totalMeals > 1 ? 's' : ''} only. Ensure ${totalMeals > 1 ? 'each meal is distinct from the others and all are' : 'it is'} clearly different from current_week_meals in protein, cuisine, and cooking method. The variety guidelines (4 proteins, 4 carbs, 4 methods) apply to the full week including current_week_meals, not just these replacements.`
      : '';

    const userPrompt = `Generate exactly ${totalMeals} meals for these slots:
${slotRequests.join("\n")}

${preferences ? `Family preferences: ${preferences}` : ""}
${currentWeekSection}${recentMealsSection}${ratingsSection}${varietyNote}
Remember: Focus on practical, family-friendly meals. NEVER duplicate current_week_meals. Avoid meals similar to recent_meals. Use ratings_context to favor highly-rated meal styles and avoid poorly-rated ones. Tag each meal with its slot_type.`;

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
