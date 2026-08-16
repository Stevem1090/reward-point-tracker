# Shopping list: fix Add Item, add Edit/Delete

## What's wrong

The "Add Item" button at the bottom of the shopping list is a plain button with no click handler — it does nothing. The underlying `addItem` mutation already exists and works; it was simply never wired to the UI.

## What to build

**1. Add item (fix)**
- Tapping "Add Item" opens a small dialog: Name, Quantity, Unit, Category (dropdown of the existing shopping categories, default "Other").
- Save calls the existing `addItem` mutation; the item appears immediately in its category group.
- Save disabled until a name is entered.

**2. Edit an item**
- Tapping an item's name (rather than the checkbox) opens the same dialog pre-filled, in edit mode.
- Editable: name, quantity, unit, category (moving it between category groups).
- Checkbox still toggles checked state as today — tapping the row's tick area never opens the dialog.

**3. Delete an item**
- The edit dialog gets a Delete action, so a mistakenly added or unwanted item can be removed individually (today only "Clear Checked" exists).

## Technical notes

- New component `src/components/meals/ShoppingItemDialog.tsx` — shared for add and edit, mobile-friendly touch targets (min 44px).
- `src/hooks/useShoppingList.ts` — add `updateItem` and `deleteItem` mutations following the existing pattern (read current `items` JSON, map/filter, update the row), with optimistic cache updates like `toggleItem` so changes feel instant.
- `src/components/meals/ShoppingListView.tsx` — wire the Add button, add dialog state, make `ShoppingItemRow`'s label area open the edit dialog while the checkbox keeps its own handler.
- No database or edge function changes; items live in the `shopping_lists.items` JSON column.
