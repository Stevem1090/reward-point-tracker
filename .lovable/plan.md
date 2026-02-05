

# Hide "View Link" Button for Library Recipes

## Problem
On finalized plans, library recipes show a "View Link" button that opens a popup saying "Unable to Extract" -- which is misleading since these meals were never meant to be extracted from a URL.

## Why It Happens
Line 411-418 in `MealSlot.tsx` shows a button for any finalized meal with a `recipe_card`. When ingredients are empty, it labels the button "View Link" (designed for failed URL extractions). Library meals that were finalized **before** our fix also have empty recipe cards, triggering this state.

## Fix
On line 411, add a condition to skip showing the button when it's a library meal with an empty/failed recipe card. Library meals going through the new finalization flow will have populated recipe cards, so "View Recipe" will appear correctly.

## Technical Change

### File: `src/components/meals/MealSlot.tsx` (line 411)

**Current:**
```typescript
{isPlanFinalised && meal.recipe_card && (
```

**Updated:**
```typescript
{isPlanFinalised && meal.recipe_card && !(meal.recipe_id && meal.recipe_card.ingredients.length === 0) && (
```

This means:
- AI meals with full recipe card: shows "View Recipe" (unchanged)
- AI meals with failed extraction: shows "View Link" (unchanged)
- Library meals with full recipe card (new flow): shows "View Recipe"
- Library meals with empty recipe card (old data): hidden (no misleading button)

## One file to modify

| File | Change |
|------|--------|
| `src/components/meals/MealSlot.tsx` | Add guard to hide "View Link" for library meals with empty recipe cards |
