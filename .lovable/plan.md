# Adding shopping items by voice from Google Home

## The short answer on Google Keep

A direct Google Keep connection is not possible for you. The Keep API only works for paid Google Workspace Enterprise accounts with an admin-configured service account, and even then it can only see notes that the service account itself created — it cannot read the Keep list your Assistant writes to. On a personal @gmail.com account there is no API at all, and no Keep integration is available in Lovable.

Custom Google Assistant "actions" are also gone — Google shut down Conversational Actions in 2023, so an app cannot register its own voice command with a Home speaker.

## What is possible

Google Home speakers can trigger an internet request through an automation bridge. The route that works today:

```text
"Hey Google, add milk to the shopping list"
        |
   Google Assistant / Home routine
        |
   IFTTT (Google Assistant -> Webhooks)
        |
   Secure webhook on this app
        |
   Item appears in the app's shopping list
```

You speak to the speaker as normal; a second or two later the item is in this app's list. Ticking off, editing and deleting all stay in the app — the app remains the single source of truth, and nothing needs to sync back.

The trade-off: IFTTT is a third-party middleman and its Google Assistant trigger phrases sit on a paid IFTTT plan. Home Assistant can do the same job for free if you already run it. I will build the app side so it works with either, and with Alexa or an iPhone Shortcut too, since they all just call the same web address.

## What gets built

**1. A standing shopping list**

Today a shopping list only exists once a meal plan is approved, and it is tied to that week's plan. Voice items need somewhere to land at any time, so the app gets a permanent "household" list that is always there. The Shopping tab shows the week's meal-plan items and the standing items together, with standing items in their own "Extras" grouping so it is obvious what came from where.

**2. A voice inbox endpoint**

A secure web address that accepts a spoken phrase such as "two tins of chopped tomatoes" and adds it to the standing list. It uses the same AI already powering the shopping list to split the phrase into quantity, unit, name and aisle category, so items land in the right group rather than as raw text. Multiple items in one sentence ("milk, bread and eggs") are split into separate entries.

The address is protected by a long secret token that only your IFTTT applet knows — without it the request is rejected. It also handles a couple of phrasings: add an item, and clear the list.

**3. Feedback in the app**

Voice-added items are marked with a small microphone icon so you can see what arrived hands-free, and the Shopping tab refreshes live so an item spoken in the kitchen shows up on an already-open phone screen.

**4. Setup instructions**

A short setup panel in the app showing your personal webhook address and the exact IFTTT applet settings to paste in, so you can wire it up in a few minutes without me needing your Google credentials.

## Open question to settle during the build

Whether the standing list should be shared across both accounts in the household or private per user. Given the earlier discussion about shared sections, I will make it shared, matching how bills and rewards already work — say if you would rather it stayed personal.

## Technical notes

- New table `standing_shopping_items` (name, quantity, unit, category, checked, source, created_at) with explicit GRANTs and RLS, plus realtime enabled so the list updates live.
- New table or secret-backed token for webhook auth: the token lives in Supabase secrets, not in the database, and is compared in the edge function.
- New edge function `voice-add-shopping-item` with `verify_jwt = false` (IFTTT cannot send a Supabase JWT) — authorisation is the shared secret in a header or path segment, checked before any work happens. Input validated with Zod, phrase length capped.
- Phrase parsing reuses the Lovable AI gateway with a small tool-call schema mirroring `generate-shopping-list`'s category list; a plain-text fallback inserts the raw phrase as an "Other" item if the AI call fails, so nothing spoken is ever lost.
- New hook `useStandingShoppingList`; `ShoppingListView` merges standing items into the existing category grouping and reuses the `ShoppingItemDialog` just built for editing.
- No change to `shopping_lists` or the meal-plan generation flow.
