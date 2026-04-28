## Goal

Make logging a chore completion feel instant and effortless on mobile by:
1. Letting the user tap **anywhere on the grid** (not just the tiny current-week box) to log a completion
2. Updating the UI **immediately** (optimistic) instead of waiting for the round-trip to Supabase
3. Letting the user **long-press anywhere on the grid** to undo the most recent completion in the current period (e.g. mis-tap)
4. Keeping the **trash icon** as the way to delete the entire chore

## UX changes

### ChoreCard
- Keep the small trash button in the top-right for full chore deletion (with existing confirm pattern).
- The whole grid becomes the interaction surface for logging/undoing the current period:
  - **Tap (anywhere on grid)** → log a completion for the current period (week/month). Current box fills/increments instantly.
  - **Long-press (~600ms, anywhere on grid)** → undo the most recent completion in the current period. If there are none, the long-press is a no-op (subtle haptic/none).
  - **Right-click (desktop)** → same as long-press (undo last in current period).
- Helper text updated to: "Tap the grid to log. Long-press to undo your last entry this {week|month}."
- The current-period box keeps its highlight ring so the user still sees which box will fill.
- Past/future boxes lose their individual click handlers — the whole grid handles the gesture.

### Long-press behavior
- Implemented via `pointerdown` timer (600ms) + cancel on `pointermove` (>10px), `pointerup`, `pointerleave`, or scroll.
- A subtle scale/opacity press animation gives feedback that a long-press is in progress.

## Performance fix (the "lag")

The current flow waits for Supabase insert → realtime broadcast → refetch all → re-render. That's why taps feel sluggish.

### Optimistic updates in `useChores`
- Add a local `pendingCompletions` state (array of `ChoreCompletion`-shaped objects with a temp `id` like `temp-${uuid}`) and a local `removedCompletionIds` set.
- `logCompletion(chore_id)`:
  1. Immediately push a temp completion `{ id: temp-uuid, chore_id, user_id, completed_at: new Date().toISOString() }` into local state.
  2. Fire the Supabase insert in the background.
  3. On success → remove the temp entry (the realtime/refetch will bring in the real one). On error → remove temp entry + toast.
- `undoLastCompletionInPeriod` (used by long-press): immediately remove the latest matching completion (from either real or pending) from the rendered set; fire Supabase delete in background; restore on error.
- The `grouped` memo merges `completions` + `pendingCompletions` minus `removedCompletionIds` so the grid + "X/Y done this week" badge update on the next render tick.

### Reduce refetch overhead
- Keep realtime subscription but debounce the realtime-triggered `fetchAll()` by ~300ms so a rapid tap doesn't fight the optimistic state.

## Technical changes

**Files to edit:**
- `src/components/chores/ChoreCard.tsx` — keep trash button; wrap `<ChoreGrid>` in a `<div>` with pointer handlers for tap (log) + long-press (undo current period).
- `src/components/chores/ChoreGrid.tsx` — make individual boxes display-only (`<div>`s, no per-box click/contextmenu/disabled). Tooltips on hover can stay for desktop.
- `src/hooks/useChores.ts` — add `pendingCompletions` + `removedCompletionIds`; merge into `grouped`; optimistic insert in `logCompletion` and optimistic delete in `undoLastCompletionInPeriod`; debounce realtime refetch.

**No DB / schema / route changes.**

## Out of scope
- Per-box editing of historical weeks (still display-only).
- Changing the trash-icon delete-chore flow.
