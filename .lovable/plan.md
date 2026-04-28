# Fix: Chore changes don't appear until page refresh

## Root cause

Two issues compound each other:

1. **Realtime is not enabled on the chore tables.** The hook `useChores.ts` subscribes to `postgres_changes` for `chores`, `chore_categories`, and `chore_completions`, but none of these tables are included in the `supabase_realtime` publication. Verified directly against the database — the publication returns no rows for them. As a result the channel never fires, and the UI only updates when `fetchAll` runs (page mount/refresh or year change).

2. **Mutations don't update local state.** `addCategory`, `addChore`, `deleteChore`, and `deleteCategory` write to Supabase but never touch the local `categories` / `chores` arrays. They rely entirely on the (broken) realtime subscription to trigger a refetch. Even once realtime is fixed, there's a perceptible delay; if realtime ever drops, the UI silently desyncs.

`logCompletion` and `undoLastCompletionInPeriod` already do optimistic updates correctly — that's why completion logging feels instant while create/delete don't.

## Plan

### 1. Database migration — enable realtime

Add the three chore tables to the `supabase_realtime` publication and ensure full row data is published so DELETE payloads include identifiable fields:

```sql
ALTER TABLE public.chores REPLICA IDENTITY FULL;
ALTER TABLE public.chore_categories REPLICA IDENTITY FULL;
ALTER TABLE public.chore_completions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chore_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chore_completions;
```

(Wrapped with existence checks so the migration is idempotent.)

### 2. Frontend — optimistic create/delete in `src/hooks/useChores.ts`

Update mutations to mirror the pattern already used for completions:

- **`addCategory`**: on successful insert, append the returned row to `categories` immediately (skip if an id-match already exists, so a racing realtime event doesn't duplicate).
- **`addChore`**: switch to `.insert(...).select().single()` and append the new chore to local `chores` on success.
- **`deleteChore`**: optimistically remove from local `chores` before the network call; restore on error.
- **`deleteCategory`**: optimistically remove from local `categories` before the network call; restore on error.

The existing realtime handler (`debouncedRefetch`) stays as the reconciliation safety net once realtime starts firing — and `fetchAll` already de-dupes by replacing arrays wholesale, so optimistic + realtime won't conflict.

## Files

- New migration (enables realtime on the three chore tables)
- `src/hooks/useChores.ts` (optimistic state updates in 4 mutations)

No UI component changes required.
