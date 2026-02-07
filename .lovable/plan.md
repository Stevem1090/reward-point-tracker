

# Per-Week Banner Dismissal with Persistence

## Problem
The banner dismiss state is stored in a simple `useState(false)` which:
1. Resets when navigating away and back (no persistence)
2. Is shared across both "this week" and "next week" since it's a single boolean

## Solution
Replace the single boolean state with a `Set<string>` of dismissed `weekStartDate` values, stored in `localStorage` so it persists across sessions.

## Technical Changes

### File: `src/components/meals/MealPlanView.tsx`

**Remove:**
```typescript
const [isBannerDismissed, setIsBannerDismissed] = useState(false);
```

**Replace with:**
```typescript
const [dismissedWeeks, setDismissedWeeks] = useState<Set<string>>(() => {
  try {
    const stored = localStorage.getItem('dismissedMealPlanBanners');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
});

const isBannerDismissed = dismissedWeeks.has(weekStartDate);

const dismissBanner = () => {
  const updated = new Set(dismissedWeeks);
  updated.add(weekStartDate);
  setDismissedWeeks(updated);
  localStorage.setItem('dismissedMealPlanBanners', JSON.stringify([...updated]));
};
```

**Update the X button handler** from `setIsBannerDismissed(true)` to `dismissBanner()`.

This way each week's banner is tracked independently and persists across page refreshes. Old weeks will accumulate in storage but the set stays tiny (just date strings).
