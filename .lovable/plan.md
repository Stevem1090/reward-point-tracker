# Google Home, Keep, and voice shopping list items

## Current default behaviour

Google Assistant uses **Google Keep** as the default shopping list. When you say:

```
"Hey Google, add bananas to my shopping list"
```

the item goes straight into the Google Keep note named "Shopping list".

A direct integration with Keep is not possible for a personal @gmail.com account, because Keep's API is restricted to Google Workspace Enterprise accounts. There is also no Keep connector in Lovable.

## How to redirect the item to this app

The app cannot intercept or replace the Google Assistant → Keep flow directly. What it can do is listen for a *different* phrase that you (or IFTTT) recognises, and add the item to the app's own shopping list.

The practical route is:

```text
"Hey Google, add bananas to my meal planner list"
        |
   IFTTT applet (Google Assistant trigger)
        |
   Webhook POST to this app
        |
   Item parsed and added to app's standing shopping list
```

IFTTT cannot stop the same item from also going to Keep if you use the exact words "shopping list". That is why the plan uses a distinct trigger phrase such as "meal planner list" or any phrase you choose.

## Why IFTTT and not a Google Home routine?

Google Home routines cannot make arbitrary webhook calls. They can run voice commands, adjust devices, and send notifications, but they cannot POST to a custom URL. A routine can say "ask IFTTT to add bananas to my meal planner list", which then fires the IFTTT webhook. That works, but IFTTT is still the bridge.

## Plan

Build the app side regardless of how the voice command is triggered:

1. **Standing shopping list** — a household list that exists independently of any week's meal plan, so voice items have a home even when no plan is approved.
2. **Secure webhook endpoint** — accepts a spoken phrase, parses it with AI into quantity/unit/name/category, and inserts items into the standing list.
3. **Voice marker** — items added by voice show a small microphone icon in the app.
4. **Setup panel** — shows the webhook URL and the exact IFTTT applet settings to paste in, using a phrase like "add {item} to my meal planner list".

The Google Keep list will continue to receive items for the default "shopping list" phrase. The app's list is the master for anything you want shared, edited, and ticked off in the app.
