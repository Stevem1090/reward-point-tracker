

# Remaining AI Meal Plan Enhancements - Full Implementation Plan

## What's Already Done (Phase 1)
- ✅ Rejection reasons (6 predefined options + skip)
- ✅ Rejected meals tracked and never re-suggested
- ✅ AI uses rejection reasons to inform replacements

---

## Phase 2: Family Preferences System

### 2.1 Database Schema
Create a new `family_preferences` table to store learned preferences:

```sql
CREATE TABLE family_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  preference_type TEXT NOT NULL,
  -- Types: 'liked_cuisine', 'liked_protein', 'liked_method', 
  --        'avoid_cuisine', 'avoid_protein', 'avoid_ingredient'
  value TEXT NOT NULL,
  confidence NUMERIC DEFAULT 1.0,
  evidence_count INTEGER DEFAULT 1,
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, preference_type, value)
);

-- Enable RLS
ALTER TABLE family_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own preferences" ON family_preferences
  FOR ALL USING (auth.uid() = user_id);
```

### 2.2 Preference Extraction Logic
After each meal is rated, analyze and update preferences. Add a new function in the `generate-meal-plan` edge function (or create a separate `update-preferences` function):

```typescript
interface PreferenceUpdate {
  type: string;
  value: string;
  delta: number; // +1 for 4-5 stars, -1 for 1-2 stars
}

function extractPreferencesFromMeal(
  mealName: string, 
  rating: number, 
  notes: string | null
): PreferenceUpdate[] {
  const updates: PreferenceUpdate[] = [];
  const delta = rating >= 4 ? 1 : rating <= 2 ? -1 : 0;
  if (delta === 0) return updates;
  
  // Detect cuisine
  const cuisines = {
    'Indian': ['curry', 'tikka', 'korma', 'biryani', 'tandoori', 'naan'],
    'Mexican': ['taco', 'burrito', 'fajita', 'enchilada', 'quesadilla'],
    'Italian': ['pasta', 'pizza', 'risotto', 'lasagne', 'bolognese'],
    'Chinese': ['stir-fry', 'noodles', 'chow mein', 'fried rice'],
    'Thai': ['pad thai', 'green curry', 'red curry', 'satay'],
  };
  
  for (const [cuisine, keywords] of Object.entries(cuisines)) {
    if (keywords.some(kw => mealName.toLowerCase().includes(kw))) {
      updates.push({ 
        type: delta > 0 ? 'liked_cuisine' : 'avoid_cuisine', 
        value: cuisine, 
        delta: Math.abs(delta) 
      });
    }
  }
  
  // Detect protein
  const proteins = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 
                    'prawns', 'tofu', 'vegetarian'];
  for (const protein of proteins) {
    if (mealName.toLowerCase().includes(protein)) {
      updates.push({ 
        type: delta > 0 ? 'liked_protein' : 'avoid_protein', 
        value: protein, 
        delta: Math.abs(delta) 
      });
    }
  }
  
  // Parse notes for specific insights
  if (notes) {
    if (notes.toLowerCase().includes('too spicy')) {
      updates.push({ type: 'avoid_ingredient', value: 'spicy dishes', delta: 2 });
    }
    if (notes.toLowerCase().includes('kids loved')) {
      updates.push({ type: 'liked_method', value: 'kid-friendly', delta: 2 });
    }
  }
  
  return updates;
}
```

### 2.3 Fetch and Format Preferences for AI
Update `generate-meal-plan/index.ts` to fetch aggregated preferences:

```typescript
async function fetchFamilyPreferences(
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const { data, error } = await supabase
    .from('family_preferences')
    .select('preference_type, value, confidence')
    .order('confidence', { ascending: false })
    .limit(30);
  
  if (error || !data?.length) return '';
  
  const liked: Record<string, string[]> = {};
  const avoid: Record<string, string[]> = {};
  
  for (const pref of data) {
    if (pref.confidence < 2) continue; // Only use confident preferences
    
    if (pref.preference_type.startsWith('liked_')) {
      const category = pref.preference_type.replace('liked_', '');
      liked[category] = liked[category] || [];
      liked[category].push(pref.value);
    } else if (pref.preference_type.startsWith('avoid_')) {
      const category = pref.preference_type.replace('avoid_', '');
      avoid[category] = avoid[category] || [];
      avoid[category].push(pref.value);
    }
  }
  
  let section = '\nFAMILY PREFERENCES (learned from ratings):\n';
  
  if (Object.keys(liked).length > 0) {
    section += 'FAVORITES:\n';
    for (const [cat, values] of Object.entries(liked)) {
      section += `- ${cat}: ${values.join(', ')}\n`;
    }
  }
  
  if (Object.keys(avoid).length > 0) {
    section += 'AVOID:\n';
    for (const [cat, values] of Object.entries(avoid)) {
      section += `- ${cat}: ${values.join(', ')}\n`;
    }
  }
  
  return section;
}
```

---

## Phase 3: Recipe Library Integration

### 3.1 Fetch Saved Recipes for AI Context
Allow the AI to suggest 1-2 recipes from the user's library each week:

```typescript
async function fetchSavedFavorites(
  supabase: ReturnType<typeof createClient>
): Promise<{ name: string; description: string; recipe_id: string }[]> {
  // Get recipes not used in last 4 weeks
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  
  // First get recently used recipe_ids from meals
  const { data: recentMeals } = await supabase
    .from('meals')
    .select('recipe_id')
    .not('recipe_id', 'is', null)
    .gte('created_at', fourWeeksAgo.toISOString());
  
  const recentRecipeIds = recentMeals?.map(m => m.recipe_id) || [];
  
  // Fetch recipes excluding recent ones
  let query = supabase
    .from('recipes')
    .select('id, name, description, estimated_cook_minutes')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (recentRecipeIds.length > 0) {
    query = query.not('id', 'in', `(${recentRecipeIds.join(',')})`);
  }
  
  const { data: recipes, error } = await query;
  
  if (error || !recipes?.length) return [];
  
  return recipes.map(r => ({
    name: r.name,
    description: r.description || '',
    recipe_id: r.id,
    cook_time: r.estimated_cook_minutes
  }));
}
```

### 3.2 Update System Prompt for Library Integration
Add to `SYSTEM_PROMPT`:

```
SAVED FAVORITES (from family recipe library):
You may receive a list of saved_recipes - these are family favorites.
- You MAY include 1-2 saved recipes per week (especially for weekend meals)
- When suggesting a saved recipe, use EXACTLY the name provided
- Mark saved recipes with source_type: "library" 
- Saved recipes can help reduce "cooking fatigue" - families love revisiting favorites
```

### 3.3 Include Library Section in User Prompt
```typescript
// Build saved recipes section
const savedRecipes = await fetchSavedFavorites(supabase);
const savedRecipesSection = savedRecipes.length > 0
  ? `\nsaved_recipes (family favorites you can include 1-2 of):\n${
      savedRecipes.map(r => `- "${r.name}" (${r.cook_time || '?'} mins)`).join('\n')
    }\n`
  : '';
```

### 3.4 Handle Library Recipe Suggestions
Update the response processing to detect when AI suggests a library recipe:

```typescript
// After getting AI meals, check if any match saved recipes
const savedRecipeMap = new Map(savedRecipes.map(r => [r.name.toLowerCase(), r.recipe_id]));

const mappedMeals = daySlotMapping.map(({ day, slotType }) => {
  // ... existing mapping logic ...
  
  // Check if this meal matches a saved recipe
  const matchedRecipeId = savedRecipeMap.get(meal.meal_name.toLowerCase());
  
  return {
    day_of_week: day,
    meal_name: meal.meal_name,
    // ... other fields ...
    recipe_id: matchedRecipeId || null, // Link to library recipe if matched
    source_type: matchedRecipeId ? 'user_library' : 'ai_generated',
  };
});
```

---

## Phase 4: Stronger Variety Enforcement

### 4.1 Update System Prompt with Hard Rules
Add explicit constraints to `SYSTEM_PROMPT`:

```
HARD VARIETY RULES (MUST follow - verify before responding):
1. Maximum 2 chicken dishes per week
2. Maximum 2 pasta/noodle dishes per week
3. Never same main protein on consecutive days
4. At least 1 vegetarian option per week
5. At least 1 fish/seafood option per week
6. Maximum 1 repeat cuisine (e.g., max 2 Italian dishes)

SELF-CHECK before responding:
- Count chicken dishes (must be ≤2)
- Count pasta dishes (must be ≤2)
- Check consecutive days have different proteins
- Verify vegetarian and fish requirements met
```

### 4.2 Post-Generation Validation Function
Add validation in the edge function to catch violations:

```typescript
interface ValidationResult {
  valid: boolean;
  issues: string[];
}

function validateMealPlan(meals: MealSuggestion[]): ValidationResult {
  const issues: string[] = [];
  const mealNames = meals.map(m => m.meal_name.toLowerCase());
  
  // Rule 1: Max 2 chicken dishes
  const chickenCount = mealNames.filter(n => 
    n.includes('chicken') || n.includes('poultry')
  ).length;
  if (chickenCount > 2) {
    issues.push(`Too many chicken dishes: ${chickenCount} (max 2)`);
  }
  
  // Rule 2: Max 2 pasta/noodle dishes
  const pastaCount = mealNames.filter(n => 
    n.includes('pasta') || n.includes('spaghetti') || 
    n.includes('noodle') || n.includes('lasagne') || n.includes('penne')
  ).length;
  if (pastaCount > 2) {
    issues.push(`Too many pasta dishes: ${pastaCount} (max 2)`);
  }
  
  // Rule 3: No consecutive same protein
  const proteinKeywords = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'prawn'];
  for (let i = 0; i < mealNames.length - 1; i++) {
    for (const protein of proteinKeywords) {
      if (mealNames[i].includes(protein) && mealNames[i + 1].includes(protein)) {
        issues.push(`Consecutive ${protein} on days ${i + 1} and ${i + 2}`);
      }
    }
  }
  
  // Rule 4: At least 1 vegetarian
  const vegKeywords = ['vegetarian', 'veggie', 'veg ', 'tofu', 'halloumi', 'paneer'];
  const hasVeg = mealNames.some(n => vegKeywords.some(kw => n.includes(kw)));
  if (!hasVeg && meals.length >= 7) {
    issues.push('No vegetarian option found');
  }
  
  // Rule 5: At least 1 fish/seafood
  const fishKeywords = ['fish', 'salmon', 'cod', 'tuna', 'prawn', 'shrimp', 'seafood'];
  const hasFish = mealNames.some(n => fishKeywords.some(kw => n.includes(kw)));
  if (!hasFish && meals.length >= 7) {
    issues.push('No fish/seafood option found');
  }
  
  return { valid: issues.length === 0, issues };
}
```

### 4.3 Retry Logic for Failed Validation
If validation fails, retry with stricter instructions:

```typescript
const aiMeals: MealSuggestion[] = JSON.parse(toolCall.function.arguments).meals;

// Validate the plan
const validation = validateMealPlan(aiMeals);
if (!validation.valid) {
  console.warn('Meal plan validation failed:', validation.issues);
  // Log issues but still return (could implement retry in future)
  // For now, we accept the plan but log for monitoring
}
```

---

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `supabase/migrations/xxx_add_family_preferences.sql` | CREATE | New preferences table |
| `supabase/functions/generate-meal-plan/index.ts` | MODIFY | Add preference fetching, library integration, validation |
| `src/integrations/supabase/types.ts` | MODIFY | Add family_preferences types (auto-generated) |

---

## Implementation Order

1. **Database Migration** - Create `family_preferences` table
2. **Edge Function Updates** - Add all new fetching functions and validation
3. **Prompt Enhancements** - Update SYSTEM_PROMPT with new sections
4. **Test End-to-End** - Verify improved variety and personalization

---

## Expected Outcomes

After implementation:
- AI will "know" the family prefers Indian and Italian food (from ratings)
- AI will avoid suggesting spicy dishes on weekdays (learned from notes)
- AI may include 1-2 saved family favorites each week
- AI will never generate 3+ chicken or pasta dishes
- Consecutive days will always have different proteins
- Each week will include at least 1 vegetarian and 1 fish option

