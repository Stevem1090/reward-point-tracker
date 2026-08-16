# Google Home, Keep, and the voice shopping list

## How it works today by default

Google Home no longer adds shopping list items to Google Keep by default. Several years ago Google switched the default list to its own **Google Shopping list** (a simple, built-in list inside Assistant/Hub, not Keep). You can still ask it to save items to a third-party list if you set that up, but out of the box "Hey Google, add bananas to my shopping list" adds to the Google Shopping list, not Keep.

However, there are still ways to redirect the phrase so it goes into this app instead of (or as well as) Google's own list.

## What IFTTT can and cannot do

IFTTT cannot "overwrite" Google Shopping list in the sense of removing the item from Google's built-in list. What IFTTT does is intercept the *command* you speak and forward it to a custom webhook. So you say something like:

```
"Hey Google, add bananas to my shopping list in the app"
```

IFTTT hears that exact phrase, then makes a web request to this app's endpoint. The app adds "bananas" to your standing shopping list. The Google Shopping list may also receive it if Google still recognises the command, or it may not if the wording is specific enough to only trigger the IFTTT applet.

In practice, people usually do one of these two things:

1. **Use a distinct trigger phrase** so Google ignores it and only IFTTT acts. Example: "Hey Google, log bananas to the app shopping list" or "Hey Google, add bananas to my meal planner shopping list". This avoids the duplicate Google list entry.
2. **Let Google keep doing its thing**, and also send the item to the app. Then you have the item in both places. The Google one might be slightly redundant, but you can treat the app as the master.

## The better option: Google Home routines

Google Home supports **Routines**. You can create a routine:

```
When I say "add bananas to my shopping list" (or any phrase)
  → Action: adjust lights, or run a custom command.
```

Routines cannot directly call a webhook, but they can run a custom command like "Ask IFTTT to add bananas to my shopping list". That then fires the IFTTT trigger. This is slightly more flexible because you can keep the natural wording and let the routine forward it.

## The cleanest practical solution for this app

Since the plan uses a shared household shopping list in the app, the recommended phrasing is:

```
"Hey Google, add {item} to my meal planner list"
```

IFTTT applet: "Google Assistant voice command" → "Webhooks" → POST to the app's endpoint with the phrase. The app parses the phrase and adds the item to the standing list.

This keeps the Google Home default list untouched (or only adds to it if you want), and the app becomes the place where you tick things off.

## If you want to avoid IFTTT entirely

Google Home's native list can be exported to Google Keep via the Google Home app settings, but it is one-way and delayed. If you want real app control and to keep things in one place, the IFTTT/webhook route is the current realistic option for a personal @gmail.com account. Home Assistant can do it for free, but only if you run it.

## Plan update

The plan remains the same: build a standing shopping list and a secure webhook, but the setup instructions will show how to use an IFTTT/Google Home routine with a specific phrasing so the item lands in the app without relying on Google Keep.
