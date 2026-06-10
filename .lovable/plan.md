# Tidy up Meal Cards and Recipe Modal

The cards and the recipe modal have grown organically — every feature (SW, calories, cooked count, edit, print, log) added its own coloured pill or button at the top level. The result reads as a stack of bright chips rather than a recipe. This plan refocuses both surfaces on what matters at a glance (meal name, cook time, servings) and demotes everything else to a single overflow menu, using neutral tokens instead of orange/purple/green pills.

## Design principles

- **One accent only.** Use neutral `muted`/`secondary` tokens for metadata. Reserve the primary colour for the recipe name link and a single primary action. Drop the orange "Library Recipe" pill, orange calories pill, and standalone purple "Swips" pill from the card.
- **Glanceable facts vs. actions.** Cook time, servings, calories, rating live as small inline icon+number metadata (no coloured backgrounds). Actions (Edit, Replace, Log to SW, Edit SW info, Print) live behind a `⋯` menu.
- **Primary tap target = open recipe.** The whole card body opens the recipe modal. "View Recipe" link and "Edit Meal" button are removed from the card face.
- **SW info is contextual.** Show a small discreet "SW" chip with the Swips number only when present; full SW management lives inside the modal's menu.

## Meal Card (MealSlot) — new layout

```text
┌──────────────────────────────────────────────────┐
│ ⋮⋮  [Tue]  Andalusian Meatballs           ⋯     │
│           Flavourful meatballs with spices…      │
│           ⏱ 25m   👥 4   🔥 350 kcal   SW 2     │
└──────────────────────────────────────────────────┘
```

- Tap card → opens recipe modal.
- `⋯` menu (only one button visible): Replace meal, Edit servings, Edit SW info, Skip day, Log to SW (when SW present), Edit URL.
- During planning (pre-finalise), the green ✓ / red ✕ approve/reject buttons stay — those are the core planning action and remain on the card.
- Remove: "View Recipe" link, "Library Recipe" pill, standalone "Swips" pill, "Log to SW" inline button, "Edit Meal" button.
- Metadata row uses `text-muted-foreground text-xs` with lucide icons — no coloured backgrounds.

## Recipe Modal (RecipeCardDialog) — new layout

```text
┌──────────────────────────────────────────────────┐
│ Andalusian Meatballs                       ⋯  ✕ │
│ ⏱ 25 min · 👥 4 servings · 🔥 350 kcal · ★ 4.2 │
│                                                  │
│ [hero image]                                     │
│                                                  │
│ Ingredients                                      │
│  …                                               │
│ Instructions                                     │
│  …                                               │
└──────────────────────────────────────────────────┘
```

- Header: title + single muted metadata strip (cook time, servings, calories, rating, cooked-count merged into rating area as "★ 4.2 · cooked 3×").
- `⋯` overflow menu replaces the row of buttons. Items: **Log to SW**, **Edit SW info** (or *Add SW info*), **Print A4**, **View original** (when URL), **Retry calories** (only when failed).
- Calorie loading/error states become subtle inline text under the metadata strip, not a coloured pill.
- SW data, when present, surfaces as a single neutral inline chip in the metadata strip ("SW 2 Swips · Speed") rather than dedicated buttons.
- Keep ingredient list and steps exactly as they are — they're already clean.

## Colour cleanup

- Replace `bg-orange-*`, `bg-purple-*`, `bg-green-*`, `bg-yellow-*` pills with `variant="secondary"` Badges using `text-muted-foreground`.
- Keep the day-of-week tile as is (it's a useful colour anchor) but unify weekend amber and weekday primary into a single muted tile for the modal; cards can keep the subtle day tile.
- Approve/reject buttons keep semantic green/red — they're action affordances, not decoration.

## Files to change

- `src/components/meals/MealSlot.tsx` — restructure card body, move actions into `⋯` menu, swap pill styles for neutral metadata row.
- `src/components/meals/RecipeCardDialog.tsx` — collapse header button row into a single `⋯` `DropdownMenu`, unify metadata strip, neutralise calorie/SW pills.

## Out of scope

- No changes to data models, SW logic, calorie estimation, drag-and-drop, or the meal-planning flow.
- `SwInfoDialog`, `SwapMealDialog`, print template untouched — only the entry points move.
- Recipe Library cards (separate component) untouched unless you want them included in a follow-up.

Want me to proceed with this, or adjust the hierarchy (e.g. keep "View Recipe" as a visible link, or surface SW more prominently)?
