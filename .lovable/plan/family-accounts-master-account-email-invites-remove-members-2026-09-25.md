# Family accounts: master account, email invites, remove members

## What you'll get
- Each **family** has one **master** (owner). Steve becomes master of the existing family; Tasha is added as a member, so nothing changes for you two day to day.
- A new **Family** page (in Profile) for the master:
  - See all members.
  - **Invite by email**: enter an email, they get an email with a join link. If they don't have an account yet, they sign up from the link and join automatically.
  - See pending invites and cancel them.
  - **Remove** a member: they instantly lose access to everything in the family (bills, rewards, calendar, meals, chores, tasks, reminders). Their own private data (e.g. their Slimming World log) is left alone but no longer linked to the family.
- Members see the family name and who's in it, and can leave the family.
- Other families using the app are fully separate: they never see your bills, tasks etc.

## How sharing works (unchanged behaviour, just scoped to the family)
- Shared with the whole family: bills, accounts, incomes, AI advice, rewards, calendar, reminders, meal plans, recipe library, shopping lists, chores, Slimming World food database, tasks.
- Still personal: Slimming World daily log, "only me" tasks, notification settings.
- Tasks: the "keep private" option stays; notifications go to family members only.

## Rules
- One family per person (a user can't be in two families at once).
- Only the master can invite or remove. The master can't remove themselves.
- Invites expire after 7 days.
- New sign-ups with no invite get their own new family where they are master.

## Steps
1. Confirm current data: list users (Steve, Tasha) and check which shared tables are currently open to everyone vs. per-user.
2. Database: add families, family members (role: master/member) and invites; add a family link to every shared table; move all existing rows into Steve's family; add Tasha as member.
3. Replace the current "any signed-in user" and "own rows only" access rules on shared tables with "members of the same family".
4. Invite email: send via the existing email setup, with a secure join link; accept page at /join.
5. Family page in Profile: members list, invite form, pending invites, remove / leave.
6. Update app screens so new items are saved into the user's family automatically; scope push notifications and reminder jobs to the family.
7. Test with both accounts: Tasha sees shared data, removal cuts access, a fresh sign-up sees nothing.

## Technical details
- Tables: `families(id, name, owner_id)`, `family_members(family_id, user_id unique, role)`, `family_invites(family_id, email, token_hash, expires_at, accepted_at)`, all with GRANTs + RLS.
- Security-definer helpers `current_family_id()` and `is_family_master(family_id)` to avoid recursive RLS.
- Add `family_id uuid not null default current_family_id()` to: bills, bill_accounts, bill_types, incomes, financial_advice_runs, reward_categories, point_entries, events, reminders, reminder_owners, meal_plans, meals (via plan), recipes, recipe_cards, shopping_lists, meal_ratings, family_preferences, freezer_flags, chore_categories, chores, chore_completions, sw_foods, sw_meals, sw_meal_items, task_sections, tasks. Backfill to Steve's family.
- Edge functions: `send-family-invite` (master-only, Resend), `accept-family-invite` (verifies token, adds member, reassigns their rows). Removal via RPC `remove_family_member` that deletes membership and push tokens scope.
- `send-push-notification` task/reminder mode filters recipients by family; `check_and_send_reminders` / freezer functions updated similarly.
- Signup trigger creates a family for users with no pending invite.
- Invite emails currently send from Resend's test sender, which only delivers to the account owner; a verified sending domain will be needed for Tasha-style invites to arrive (or use Lovable Emails).
