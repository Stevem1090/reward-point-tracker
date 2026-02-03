

# Enhanced AI Meal Plan Generation - Updated Plan

Based on your feedback, I've refined the plan to include predefined rejection reasons and ensure rejected meals are never re-suggested.

---

## 1. Predefined Rejection Reasons

Instead of free text, users choose from 5 quick options:

| Option | What it tells the AI |
|--------|---------------------|
| "Had it recently" | Duplicate/similar meal detected by user |
| "Don't fancy it" | General dislike, suggest different style |
| "Too complex" | Suggest simpler alternatives |
| "Ingredients hard to find" | Suggest more accessible ingredients |
| "Not kid-friendly" | Avoid spicy/unfamiliar for kids |
| "Other reason" (optional text) | Free text if needed |
| "Skip" | No reason given |

### UI Implementation

When user clicks reject (X button), show a quick popover/dialog:

```
Why are you rejecting this meal?
┌─────────────────────────────────┐
│ ○ Had it recently               │
│ ○ Don't fancy it                │
│ ○ Too complex                   │
│ ○ Ingredients hard to find      │
│ ○ Not kid-friendly              │
│ ○ Other: [text field]           │
├─────────────────────────────────┤
│ [Skip]              [Confirm]   │
└─────────────────────────────────┘
```

---

## 2. Track ALL Rejected Meals for the Week

### Current Problem
When regenerating, only `approvedMealNames` are passed as exclusions. This means:
- A meal rejected on Monday could be re-suggested for Tuesday replacement
- User has to reject the same meal multiple times

### Solution
Track and pass BOTH:
- `excludeMeals`: Current week's approved meals (absolute exclusion)
- `rejectedMeals`: All meals rejected this week with their reasons

### Database Change

Add `rejection_reason` column to `meals` table:

```sql
ALTER TABLE meals 
ADD COLUMN rejection_reason TEXT;
```

When a meal is rejected, store the reason code (e.g., "had_recently", "too_complex", "not_kid_friendly").

---

## 3. Updated Regeneration Flow

### Current Flow (MealPlanView.tsx)
```typescript
const approvedMealNames = mealPlan.meals
  .filter(m => m.status === 'approved')
  .map(m => m.meal_name);

await generateMealPlan.mutateAsync({
  excludeMeals: approvedMealNames,  // Only approved meals!
});
```

### New Flow
```typescript
const approvedMealNames = mealPlan.meals
  .filter(m => m.status === 'approved')
  .map(m => m.meal_name);

const rejectedMeals = mealPlan.meals
  .filter(m => m.status === 'rejected')
  .map(m => ({
    name: m.meal_name,
    reason: m.rejection_reason || 'no_reason'
  }));

await generateMealPlan.mutateAsync({
  excludeMeals: approvedMealNames,
  rejectedMeals: rejectedMeals,  // NEW: Pass rejected meals with reasons
});
```

---

## 4. Edge Function Enhancement

Update `generate-meal-plan/index.ts` to receive and use rejected meals:

### New Section in Prompt
```
REJECTED THIS WEEK (NEVER re-suggest these or similar):
- Chicken Fajitas (reason: had_recently)
- Thai Green Curry (reason: not_kid_friendly)
- Lamb Tagine (reason: ingredients_hard_to_find)

When generating replacements, consider the rejection reasons:
- "had_recently" → suggest completely different dish type
- "too_complex" → suggest simpler, quicker alternatives
- "not_kid_friendly" → suggest milder, more familiar options
- "ingredients_hard_to_find" → use common supermarket ingredients only
```

### Updated User Prompt Structure
```typescript
// Build rejected meals section
const rejectedMealsSection = rejectedMeals?.length > 0
  ? `\nrejected_this_week (NEVER re-suggest, consider reasons):\n${
      rejectedMeals.map(m => `- ${m.name} (reason: ${m.reason})`).join('\n')
    }\n`
  : '';

const userPrompt = `Generate exactly ${totalMeals} meals for these slots:
${slotRequests.join("\n")}

${preferences ? `Family preferences: ${preferences}` : ""}
${currentWeekSection}${rejectedMealsSection}${recentMealsSection}${ratingsSection}${varietyNote}
Remember: NEVER duplicate current_week_meals or rejected_this_week.`;
```

---

## 5. Files to Modify

| File | Changes |
|------|---------|
| Database migration | Add `rejection_reason` column to `meals` |
| `src/components/meals/MealSlot.tsx` | Add rejection reason popover UI |
| `src/hooks/useMealPlans.ts` | Update `updateMealStatus` to accept reason |
| `src/hooks/useAIMealGeneration.ts` | Add `rejectedMeals` parameter |
| `src/components/meals/MealPlanView.tsx` | Pass rejected meals to regeneration |
| `supabase/functions/generate-meal-plan/index.ts` | Handle rejected meals in prompt |
| `src/types/meal.ts` | Add rejection reason types |

---

## 6. Type Definitions

```typescript
// Add to src/types/meal.ts
export const REJECTION_REASONS = [
  { code: 'had_recently', label: 'Had it recently' },
  { code: 'dont_fancy', label: "Don't fancy it" },
  { code: 'too_complex', label: 'Too complex' },
  { code: 'hard_to_find', label: 'Ingredients hard to find' },
  { code: 'not_kid_friendly', label: 'Not kid-friendly' },
  { code: 'other', label: 'Other reason' },
] as const;

export type RejectionReason = typeof REJECTION_REASONS[number]['code'] | null;
```

---

## 7. Rejection UI Component

Create a simple popover that appears when rejecting:

```tsx
// In MealSlot.tsx - new state
const [isRejectReasonOpen, setIsRejectReasonOpen] = useState(false);
const [selectedReason, setSelectedReason] = useState<string | null>(null);
const [otherReason, setOtherReason] = useState('');

// Reject button now opens popover
const handleRejectClick = () => {
  setIsRejectReasonOpen(true);
};

const handleConfirmReject = () => {
  const reason = selectedReason === 'other' ? otherReason : selectedReason;
  updateMealStatus.mutate({ 
    mealId: meal.id, 
    status: 'rejected',
    rejectionReason: reason || null
  });
  setIsRejectReasonOpen(false);
  setSelectedReason(null);
  setOtherReason('');
};

const handleSkipReason = () => {
  updateMealStatus.mutate({ 
    mealId: meal.id, 
    status: 'rejected',
    rejectionReason: null
  });
  setIsRejectReasonOpen(false);
};
```

---

## 8. Summary of Changes

### What Users Will Experience
1. Click X to reject → see 5 quick options
2. Select reason (or skip) → meal marked rejected
3. Click "Regenerate Rejected" → AI receives:
   - All approved meal names (don't duplicate)
   - All rejected meal names + reasons (never re-suggest)
   - Historical ratings context
   - Recent 4-week meal history

### What AI Receives
```
current_week_meals (ABSOLUTE EXCLUSION):
- Spaghetti Bolognese
- Chicken Stir-fry

rejected_this_week (NEVER re-suggest, consider reasons):
- Lamb Tagine (reason: hard_to_find)
- Thai Green Curry (reason: not_kid_friendly)

recent_meals (avoid repeats from past 4 weeks):
- Fish Pie
- Beef Burgers
- ...
```

This ensures the AI never re-suggests a meal that was rejected earlier in the same planning session.

