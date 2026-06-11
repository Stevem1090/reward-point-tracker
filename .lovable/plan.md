# Improve Replace/Reject Flow in Meal Planning

Two related changes in the meal planning UI.

## 1. Restore full action set after a meal is rejected

**Problem:** Once a meal in a plan is approved, the user can change their mind and reject it. But on mobile, a rejected (or approved) meal only shows a single button (Approve or Reject) — there is no way to manually **Replace** the meal or **Skip** the day without going through AI regeneration. Desktop already exposes these via the `⋯` menu; mobile does not.

**Fix in `src/components/meals/MealSlot.tsx`:**

- In the mobile "non-pending" action row (currently only shows the opposite-status button), add a `⋯` overflow menu with:
  - **Approve** (when status is `rejected`)
  - **Reject** (when status is `approved`)
  - **Replace Meal** (opens `SwapMealDialog`) — available for both approved and rejected
  - **Skip Day** — available for both approved and rejected
- Keep the existing single inline button as a fast-tap shortcut, or fold everything into the menu — pick the menu-only approach for consistency with the pending state on mobile (Approve/Reject/⋯).
- On desktop, the dropdown for non-pending already contains Replace + Skip; just confirm both Approve and Reject entries are present depending on current status (Reject already shown for approved; Approve already shown for rejected). No structural change needed there.

Scope is the in-planning state (`isPlanFinalised === false`). The finalised-plan menu (Edit Meal / Log to SW) is unchanged.

## 2. Add photo upload to the Replace Meal dialog

**Problem:** `SwapMealDialog` lets the user pick from Library or enter a Custom Meal manually. There is no way to add a meal from a cookbook photo the way `AddRecipeDialog` already supports.

**Fix in `src/components/meals/SwapMealDialog.tsx`:**

- Add a third tab **From Photo** alongside `From Library` and `Custom Meal`.
- Reuse the same multi-image upload UX as `AddRecipeDialog`'s cookbook tab (up to 5 photos, 10MB each, grid preview with remove button, optional cookbook title and recipe name fields).
- On Extract, call the existing `processCookbook` mutation from `useDirectRecipeExtraction`.
- When extraction returns, immediately call `onSwap({...})` with the extracted recipe's name, description, servings, estimated cook time, and `recipe_url` (if any) so the meal slot is replaced/added. The extracted ingredients/steps are not saved to the user's recipe library from this flow (the dialog's job is to swap a meal, not to save a library recipe) — this matches the current Custom Meal behaviour. If the user wants it in the library, they use the Recipes tab.

UI shape:

```text
Tabs: [ From Library ] [ Custom Meal ] [ From Photo ]
                                         └── cookbook title (optional)
                                             recipe name (optional)
                                             [photo grid + add tile, max 5]
                                             [ Extract Recipe ] button
```

## Technical notes

- `SwapMealDialog` already imports `Tabs`, `Input`, `Label`, `Button`. Add `Camera`, `X`, `Loader2` icons (Loader2 already imported).
- Import `useDirectRecipeExtraction` and follow the cookbook flow used in `AddRecipeDialog.tsx`.
- Image state shape: `{ file: File; preview: string }[]` with `MAX_IMAGES = 5`.
- After successful extraction, map to the existing `onSwap` payload — no new prop needed on `SwapMealDialog`.
- For `MealSlot.tsx` mobile menu, reuse the existing `DropdownMenu` pattern already used in the pending state (lines 684–701) to keep visual consistency.

## Out of scope

- No changes to AI regeneration, edge functions, recipe library, or finalised-plan editing.
- No DB or schema changes.
- Extracted photo meals during a swap are not auto-saved to the user's recipe library.