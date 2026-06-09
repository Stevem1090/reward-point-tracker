# Multi-image cookbook recipe upload

Let users attach multiple photos (e.g. cover, ingredients page, steps page) in the **From Cookbook** tab so the AI can combine them into a single recipe extraction.

## UX changes (`AddRecipeDialog.tsx`)

- Replace the single image slot in the Cookbook tab with a **gallery of thumbnails + an "Add photo" tile**.
- Each thumbnail has a small × to remove it. Tiles render in a responsive grid (3 per row on mobile).
- File input keeps `accept="image/*"` and gains `multiple`. Selecting more images appends to the existing list rather than replacing it.
- Limits: **max 5 images**, each ≤10MB. Show toast if exceeded.
- Helper copy updates to: "Add one or more photos — e.g. the ingredients page and the method page".
- Extract button enabled when at least one image is present; label becomes "Extract Recipe" (unchanged), spinner copy: "Extracting from N photo(s)…".
- State refactor: `imageFile/imagePreview` → `images: { file: File; preview: string }[]`. `resetForm` clears the array.

## Hook changes (`useDirectRecipeExtraction.ts`)

- `ProcessCookbookParams.imageData: string` → `imagesData: string[]` (array of data URLs). Keep `cookbookTitle` and `recipeName`.
- Pass `imagesData` through to the edge function body.

## Edge function changes (`process-cookbook-recipe/index.ts`)

- Accept `imagesData: string[]` (with backward-compatible fallback: if `imageData` string is sent, wrap to array).
- Build the user message with one `text` part plus **one `image_url` part per photo**, in the order received.
- Update system prompt with a short note: "The user may provide multiple photos of the same recipe (e.g. ingredients page and method page). Treat them as one recipe and merge information across images."
- Reject if `imagesData` is empty or longer than 5.
- Model stays `google/gemini-2.5-flash` (multimodal, supports multiple image parts).

## Out of scope

- No DB schema changes. Only the first photo (if any) is still used as `image_url` when the AI returns one; we don't persist the uploaded photos themselves.
- Website tab is unchanged.

## Files touched

- `src/components/meals/AddRecipeDialog.tsx`
- `src/hooks/useDirectRecipeExtraction.ts`
- `supabase/functions/process-cookbook-recipe/index.ts`
