# Enhanced AI Meal Plan Generation

## Status: ✅ Phase 1 Complete

### Implemented Features

#### 1. Predefined Rejection Reasons
When rejecting a meal, users now see a dialog with 6 options:
- "Had it recently" → AI suggests completely different dish type
- "Don't fancy it" → AI suggests different cuisine/style
- "Too complex" → AI suggests simpler alternatives (max 20-25 mins)
- "Ingredients hard to find" → AI uses only common supermarket ingredients
- "Not kid-friendly" → AI suggests milder, familiar options
- "Other reason" → Free text input

Users can also "Skip" to reject without a reason.

#### 2. Rejected Meals Tracking
- Added `rejection_reason` column to `meals` table
- Rejected meals are now passed to AI generation as absolute exclusions
- AI receives both the meal name AND the rejection reason

#### 3. Smart Regeneration
When regenerating rejected meals:
- All approved meal names → passed as `excludeMeals`
- All rejected meal names + reasons → passed as `rejectedMeals`
- AI is instructed to NEVER re-suggest rejected meals
- AI uses rejection reasons to inform replacement suggestions

---

## Future Phases (Not Yet Implemented)

### Phase 2: Family Preferences System
- Create `family_preferences` table
- Aggregate cuisine/protein/method preferences from ratings
- Auto-update preferences after each meal rating

### Phase 3: Recipe Library Integration
- Pass saved recipes to AI generation
- Allow AI to suggest 1-2 favorites per week
- Link suggested meals to existing recipe_ids

### Phase 4: Stronger Variety Enforcement
- Post-generation validation
- Automatic re-generation if variety rules violated
- Max 2 chicken/pasta dishes per week enforcement
