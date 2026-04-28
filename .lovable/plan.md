# Harden Calorie Estimation

## Problem

Calorie estimation occasionally fails to populate when opening a recipe card. Edge function logs confirm the root cause: **transient 502 "Bad gateway" errors from the Lovable AI Gateway (Cloudflare upstream)**. When this happens, no value is saved, the badge is missing, and the user has no feedback. It only re-attempts the next time the dialog is opened.

## Changes

### 1. Edge function — retry transient failures (`supabase/functions/estimate-calories/index.ts`)

Wrap the AI gateway `fetch` in a retry loop:
- Up to 3 attempts total
- Retry only on 502/503/504 and network errors (not 429/402/400)
- Exponential backoff: 500ms, then 1500ms
- Log each retry attempt for observability

This alone should eliminate the vast majority of the failures you're seeing.

### 2. Client — surface in-progress and failure states (`src/components/meals/RecipeCardDialog.tsx`)

- Add a small "Estimating…" placeholder badge while the request is in flight, so the user knows something is happening
- On failure (network error, 429, 402), show a subtle "Calories unavailable" badge with a tooltip explaining the reason — no scary red error
- Add a small retry button on the failure badge so the user can manually re-trigger without closing/reopening the dialog

### 3. Client hook — return structured result (`src/hooks/useCalorieEstimation.ts`)

Currently returns `number | null`, swallowing the reason for failure. Change to return:
```ts
{ status: 'ok', calories: number }
| { status: 'rate_limited' }
| { status: 'credits_exhausted' }
| { status: 'error', message?: string }
```
So the dialog can render the right badge.

### 4. (Optional) Background re-attempt on dialog mount

If a previously failed estimate exists (no value, ingredients present), the existing logic already re-tries on next open. With retry + UX feedback above, this becomes reliable. No extra change needed unless we want a periodic background backfill — which I'd skip to keep AI usage low.

## Out of scope (call out, don't change)

- **Library previews still won't show calories** (synthetic recipe cards where `meal_id === id`). This is intentional today. If you want calories there too, that's a separate piece of work — would need to either persist calories on the `recipes` table, or compute on the fly without persisting.
- **No bulk pre-warming** of calories at meal-plan finalization time. Could be added later if you want all cards to have calories before the user ever opens them.

## Files touched

- `supabase/functions/estimate-calories/index.ts` — add retry loop
- `src/hooks/useCalorieEstimation.ts` — structured return type
- `src/components/meals/RecipeCardDialog.tsx` — loading / error / retry UI

No DB migration needed.
