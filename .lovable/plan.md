

# Refactor Meal Plan Edge Function for Better Variety

## What's changing
Five improvements to the AI meal generation to reduce repetitiveness and produce more diverse, interesting meal plans.

## Changes (all in one file: `supabase/functions/generate-meal-plan/index.ts`)

### 1. Model upgrade
Switch from `google/gemini-2.5-flash` to `google/gemini-2.5-pro` for stronger reasoning and better constraint adherence.

### 2. AI parameters
Add `temperature: 1.0`, `presence_penalty: 0.6`, `frequency_penalty: 0.3` to push the model toward more diverse outputs.

### 3. Weekly theme injection
Add a `WEEKLY_THEMES` array of 10 themes (e.g., "Street Food Classics", "Mediterranean Summer", "Asian Fusion", "One-Pot Wonders"). One is randomly selected per request and prepended to the user prompt as loose inspiration for 2-3 meals.

### 4. Strengthened two-pass planning
Update the TWO-PASS PLANNING instruction to be more explicit: brainstorm 20 candidates across 8 cuisines, 6 proteins, 5 cooking methods — then select the final meals from that pool.

### 5. Prompt restructuring (recency bias)
Reorder the system prompt so the critical exclusion rules are at the END (where LLMs pay most attention):
- **Top**: Identity, balance, naming, slot timing, URL instructions
- **Middle**: Ratings, preferences, saved recipes, conflict priority
- **End**: Two-pass planning → Hard variety rules + self-check → Recent meals / current week / rejected exclusions

## Technical details
- No database or frontend changes
- Output schema (`suggest_meals` function) is unchanged
- All existing Supabase fetching logic (recent meals, ratings, saved recipes, preferences) stays intact
- The edge function will be redeployed after changes

