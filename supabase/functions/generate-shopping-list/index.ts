import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPPING_CATEGORIES = [
  "Meat and Fish",
  "Vegetables",
  "Fruit",
  "Dairy and Eggs",
  "Bakery",
  "Pantry and Dry Goods",
  "Frozen",
  "Herbs and Spices",
  "Sauces and Condiments",
  "Other",
];

const SYSTEM_PROMPT = `You are a shopping list organizer. Given a list of ingredients from multiple recipes, consolidate them into a shopping list.

RULES:
- Combine duplicate ingredients (e.g., 2 recipes need onions - combine the quantities)
- Convert all measurements to UK metrics
- Categorize each item into one of these categories: ${SHOPPING_CATEGORIES.join(", ")}
- Round quantities sensibly for shopping (e.g., don't list 1.33 onions, round to 2)
- Keep ingredient names simple and clear

You MUST use the create_shopping_list function to return your response.`;

interface Ingredient {
  quantity: string;
  unit: string;
  name: string;
}

interface MealIngredients {
  mealName: string;
  servings: number;
  ingredients: Ingredient[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meals }: { meals: MealIngredients[] } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!meals?.length) {
      return new Response(
        JSON.stringify({ items: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ingredientsList = meals.map(meal => 
      `${meal.mealName} (${meal.servings} servings):\n${meal.ingredients.map(i => 
        `- ${i.quantity} ${i.unit} ${i.name}`
      ).join("\n")}`
    ).join("\n\n");

    const userPrompt = `Create a consolidated shopping list from these meal ingredients:\n\n${ingredientsList}`;

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
              name: "create_shopping_list",
              description: "Return the consolidated shopping list",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        quantity: { type: "string" },
                        unit: { type: "string" },
                        category: { 
                          type: "string",
                          enum: SHOPPING_CATEGORIES,
                        },
                      },
                      required: ["name", "quantity", "unit", "category"],
                    },
                  },
                },
                required: ["items"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_shopping_list" } },
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

    const { items } = JSON.parse(toolCall.function.arguments);

    // Add unique IDs to each item
    const itemsWithIds = items.map((item: any, index: number) => ({
      ...item,
      id: `item-${Date.now()}-${index}`,
      checked: false,
    }));

    return new Response(
      JSON.stringify({ items: itemsWithIds }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating shopping list:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate shopping list" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
