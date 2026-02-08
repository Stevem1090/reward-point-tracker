

# Freezer Reminder System

## Concept

When the weekly shop arrives and items go into the freezer, users need a way to flag specific meals as having frozen items, then receive a push notification the evening before to defrost them.

## User Flow

1. After a meal plan is finalised, each meal card gets a small **snowflake toggle** (an icon button)
2. Tapping it marks that meal as "needs defrosting" -- the snowflake stays highlighted and a subtle "Frozen" badge appears
3. The system automatically schedules a push notification for **6pm the evening before** each flagged meal's day
4. A small summary section at the top of the finalised plan shows which meals are flagged, so users have an at-a-glance view
5. Tapping the snowflake again removes the flag and cancels the reminder

## UI Design

### On each MealSlot (finalised plans only)

- A `Snowflake` icon button appears in the meal card's action area
- When active: filled/highlighted snowflake + a small "Frozen" badge next to the "Library Recipe" badge
- When inactive: subtle outline snowflake, no badge

### Freezer summary banner (optional, above the day list)

- Only shows when at least one meal is flagged
- Simple text like: "Defrost reminders set for: Tuesday (Chicken Curry), Thursday (Salmon)"
- Dismissible with X, same pattern as the approved banner

## Technical Implementation

### 1. Database: New `freezer_flags` table

```
freezer_flags
- id (uuid, PK)
- meal_id (uuid, FK to meals)
- user_id (uuid, for RLS)
- reminder_sent (boolean, default false) -- prevents duplicate sends
- created_at (timestamptz)
```

RLS policies: users can only CRUD their own flags (via meal_plan ownership chain or direct user_id match).

### 2. Frontend changes

**File: `src/types/meal.ts`**
- No changes needed to Meal type -- freezer state lives in separate table

**File: `src/hooks/useFreezerFlags.ts` (new)**
- Hook to fetch, toggle, and manage freezer flags for a given meal plan
- `useFreezerFlags(mealPlanId)` returns flags map and toggle mutation
- Uses `supabase.from('freezer_flags')` with meal_id lookups

**File: `src/components/meals/MealSlot.tsx`**
- Accept new props: `isFrozen: boolean`, `onToggleFrozen: () => void`
- Show snowflake icon button on finalised meals
- Show "Frozen" badge when flagged

**File: `src/components/meals/MealPlanView.tsx`**
- Use `useFreezerFlags` hook
- Pass frozen state and toggle handler down to each MealSlot
- Render optional freezer summary banner above meal list

### 3. Notification scheduling

Two approaches to consider:

**Option A -- Cron-based (leverages existing infrastructure):**
- The existing `check_and_send_reminders` cron runs every minute
- Add a new SQL function `check_freezer_reminders()` that:
  - Looks at `freezer_flags` where `reminder_sent = false`
  - Joins to `meals` to get `day_of_week`
  - Calculates if it's 6pm the evening before that meal's day (using the meal plan's `week_start_date` to get actual dates)
  - Calls the existing `send-push-notification` edge function
  - Marks `reminder_sent = true`
- Schedule this alongside existing cron

**Option B -- Edge function triggered on toggle (simpler):**
- When user toggles the snowflake ON, call an edge function that schedules a one-time `pg_cron` job for 6pm the day before
- When toggled OFF, cancel the scheduled job
- More precise but more complex cron management

**Recommendation: Option A** -- it fits the existing pattern, reuses the cron + push notification infrastructure, and is simpler to maintain.

### 4. Reminder timing logic

Given a meal on "Wednesday" and a `week_start_date` of "2026-02-09" (Monday):
- Wednesday = week_start_date + 2 days = 2026-02-11
- Reminder = 2026-02-10 at 18:00 (Tuesday evening)

Special case: Monday meals get a reminder on Sunday evening (week_start_date - 1 day at 18:00). This still works since the shopping would have arrived by then.

### 5. Edge function: reuse existing

No new edge function needed -- the existing `send-push-notification` function handles everything. The cron function just needs to call it with the right user ID, title ("Defrost Reminder"), and body ("Take out the chicken for tomorrow's Chicken Curry").

## Files summary

| File | Action | Purpose |
|------|--------|---------|
| Migration SQL | Create | `freezer_flags` table + RLS policies |
| `src/hooks/useFreezerFlags.ts` | Create | Hook to manage freezer flags |
| `src/components/meals/MealSlot.tsx` | Modify | Add snowflake toggle + frozen badge |
| `src/components/meals/MealPlanView.tsx` | Modify | Wire up freezer flags, optional summary |
| `supabase/functions/check_freezer_reminders.sql` | Create | Cron function to check and send defrost reminders |

## Considerations

- **Reminder time**: 6pm is a sensible default. Could later be made configurable via user settings.
- **Monday meals**: Reminder goes out Sunday evening -- this assumes shopping is done by Sunday at the latest.
- **Push notification dependency**: This only works for users who have push notifications enabled. The UI should work regardless (flagging meals is useful even without notifications), but the reminder won't fire without a push subscription.
- **Re-generation**: If a meal plan is deleted and regenerated, the freezer flags are lost (since they reference meal IDs). This is acceptable since the meals themselves change.

