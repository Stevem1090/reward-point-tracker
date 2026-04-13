

# Restore Delete Plan for Finalized Plans

## Problem
The delete plan functionality was previously accessible from the green "Meal plan approved!" banner. When that banner's delete button was replaced with a dismiss X, finalized plans lost the ability to be deleted entirely. The current delete button only appears for draft plans (line 763: `!isPlanFinalised`).

## Solution
Add a separate "Delete Plan" button that appears on finalized plans. Place it below the meal list, styled subtly (ghost/destructive) so it doesn't compete with the main UI. It reuses the existing `isDeleteDialogOpen` dialog.

## Technical Details

**File: `src/components/meals/MealPlanView.tsx`**

Add a delete button section after the draft action buttons block, visible only when the plan IS finalized:

```tsx
{isPlanFinalised && mealPlan && (
  <div className="pt-4 flex justify-center">
    <Button 
      variant="ghost"
      onClick={() => setIsDeleteDialogOpen(true)}
      disabled={isDeleting}
      className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="h-4 w-4" />
      Delete Plan
    </Button>
  </div>
)}
```

This goes after the existing `{!isPlanFinalised && ...}` action buttons block (around line 864) and before the AlertDialog. One small addition, no other files changed.

