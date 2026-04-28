# Fix: Add Chore button does nothing on first use

## Root cause

In `src/components/chores/AddChoreDialog.tsx`, the submit handler decides whether to create a new category based on a `creatingCategory` flag. That flag is only ever set to `true` by the "+ New category" link, which is only rendered when at least one category already exists.

For a brand-new user with zero categories, the dialog automatically renders the "new category" input branch (because `categories.length === 0`), but `creatingCategory` stays `false`. On submit:

1. The new-category branch is skipped (`creatingCategory` is false)
2. `catId` stays empty
3. `if (!catId) return;` exits silently — no insert, no toast, button appears broken

## Fix

Treat the dialog as "creating a category" whenever either:
- the user clicked "+ New category", OR
- there are no categories yet (forced new-category mode)

Concretely in `AddChoreDialog.tsx`:

- Derive `isCreatingCategory = creatingCategory || categories.length === 0`
- Use that derived value for both the render branch and the submit logic
- In `handleSubmit`, when in create mode, validate `newCategory.trim()` and surface a clear early-return (disable the button instead of silent return)
- Disable the "Add chore" button when required fields are missing (`!name.trim() || (isCreatingCategory ? !newCategory.trim() : !categoryId)`) so the user gets visual feedback

## Files changed

- `src/components/chores/AddChoreDialog.tsx` — derive create-mode from category count, fix submit, tighten disabled state

No database, RLS, or hook changes needed — `addCategory` and `addChore` in `useChores.ts` already work correctly; they just weren't being called in the empty-state flow.
