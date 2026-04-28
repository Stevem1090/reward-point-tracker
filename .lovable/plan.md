## Problem

The DB is saving correctly (verified — completions are persisting). The flicker is caused by client-side state reconciliation bugs in `useChores.ts`:

1. **Pending completions removed too early.** After insert succeeds, we drop the `temp-` row after 600ms. But `fetchAll` is debounced 300ms after the realtime event, AND the realtime event for the inserted row may arrive before the followup fetch completes — there's a window where the pending row is gone but the real row hasn't landed in `completions` yet → count drops, then comes back up.

2. **`removedCompletionIds` never cleared.** After undo, we add the deleted row's ID to `removedCompletionIds`. The refetch returns a list that no longer contains that ID, but the Set still holds it forever. Not visually wrong yet, but it leaks and can hide a row if the same ID ever reappears.

3. **Year-window mismatch.** `fetchAll` only fetches completions for `selectedYear`. If the user logs while viewing a previous year (edge case), the real row never appears in `completions`, the temp is dropped, and the count permanently reverts.

4. **Race on rapid taps.** Multiple taps in <600ms each schedule their own `setTimeout` to drop their temp row, while the debounced refetch coalesces. Counts can briefly desync.

## Fix

Rewrite the reconciliation in `src/hooks/useChores.ts` so pending/removed state is cleared **based on what the server returns**, not on timers:

- **Keep pending until reconciled.** Don't `setTimeout` to remove `temp-` rows. Instead, after each `fetchAll` completes, drop any pending rows whose `(chore_id + completed_at within ~10s window)` now exists in the fetched `completions`. Fallback: drop pending older than 30s (covers the cross-year edge case so they don't accumulate).
- **Clear `removedCompletionIds` on refetch.** After fetch, intersect the set with IDs still present in `completions` — IDs no longer present have been confirmed deleted and can be dropped from the set.
- **Insert returns the row.** Use `.insert(...).select().single()` so we know the real ID immediately and can map temp → real in one step (more reliable than the time-window match).
- **Single source of truth for "now".** Use the returned row's `completed_at` to replace the optimistic timestamp.
- **Refetch immediately on own writes** (not debounced) so the user's own action reconciles fast; keep the 300ms debounce only for realtime events triggered by other tabs/devices.

## Files

- `src/hooks/useChores.ts` — rewrite `logCompletion`, `undoLastCompletionInPeriod`, and `fetchAll` reconciliation logic as above. No UI/component changes needed.

## Expected result

Tap → count goes up instantly and stays up. Long-press → count goes down instantly and stays down. No revert/flicker after the network round-trip.
