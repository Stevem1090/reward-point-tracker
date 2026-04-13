

# Fix: Add 'skipped' to meals status check constraint

## Problem
The database has a CHECK constraint (`meals_status_check`) that only allows `'pending'`, `'approved'`, `'rejected'` as valid status values. The new skip feature tries to set status to `'skipped'`, which violates this constraint.

## Solution
Create a migration to drop the old constraint and add a new one that includes `'skipped'`.

## Technical Details

**New migration file:**
```sql
ALTER TABLE public.meals DROP CONSTRAINT meals_status_check;
ALTER TABLE public.meals ADD CONSTRAINT meals_status_check 
  CHECK (status = ANY (ARRAY['pending', 'approved', 'rejected', 'skipped']));
```

One migration file to create. No code changes needed — the hooks already handle `'skipped'` correctly.

