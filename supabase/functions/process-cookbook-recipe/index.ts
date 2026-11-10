import { geminiJson, geminiErrorResponse, GEMINI_LITE_MODEL } from "../_shared/gemini.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCaller } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a recipe extraction assistant. Extract recipe details from the provided cookbook page(s).

MULTI-IMAGE NOTE:
- The user may provide multiple photos of the SAME recipe (e.g. an ingredients page and a method page, or several screenshots).
- Treat all provided images as ONE recipe and merge information across them.
- Do not duplicate ingredients or steps that appear in more than one image.

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

You MUST use the format_recipe function to return your response.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!(await getCaller(req))) {
      return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = await req.json();
    const { imageData, imagesData, cookbookTitle, recipeName } = body ?? {};
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const images: string[] = Array.isArray(imagesData) && imagesData.length > 0
      ? imagesData
      : (typeof imageData === "string" && imageData ? [imageData] : []);

    if (images.length === 0) {
      throw new Error("At least one cookbook photo is required");
    }
    if (images.length > 5) {
      throw new Error("A maximum of 5 photos is allowed");
    }

    const textPrompt = `Extract the recipe from ${images.length > 1 ? `these ${images.length} cookbook page photos (they are all the same recipe — merge information across them)` : 'this cookbook page photo'}.${cookbookTitle ? ` Cookbook: "${cookbookTitle}".` : ''}${recipeName ? ` Recipe name hint: "${recipeName}".` : ''}`;

    const recipe = await geminiJson({
      system: SYSTEM_PROMPT,
      user: [{ text: textPrompt }, ...images.map((url: string) => ({ image: url }))],
      schema: {
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
                properties: { quantity: { type: "string" }, unit: { type: "string" }, name: { type: "string" } },
                required: ["quantity", "unit", "name"],
              },
            },
            steps: { type: "array", items: { type: "string" } },
          },
          required: ["name", "description", "servings", "ingredients", "steps"],
        },
    });

    return new Response(
      JSON.stringify({ recipe, cookbookTitle }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing cookbook recipe:", error);
    return geminiErrorResponse(error, corsHeaders);
  }
});
