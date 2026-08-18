# Bills: custom frequency, expiry, income and money-destination accounts

## 1. Custom frequency ("3x this period")
- New frequency option `custom` on a bill, with a "times per pay period" number (e.g. 3).
- Total for the period = amount x times. No specific dates needed.
- Shows in the summary as "3 payments x £X".

## 2. Expiry date on bills
- Optional "Stops after" date on every bill.
- Any pay period that starts after the expiry date contributes £0 for that bill; part periods only count payments dated on or before expiry (for count-based frequencies, the bill simply stops from the first period beginning after expiry).
- Bill list shows an "Ends 12 Mar 2027" hint, and "Expired" once past.

## 3. Income
- New "Income" section: named entries (e.g. "Steve's Salary") with a simple monthly amount, an active toggle, and optional expiry.
- Managed in a new tab on the Bills page: add, edit, delete, activate/deactivate.
- Total income per pay period = sum of active entries.

## 4. Accounts (where the money goes)
- New "Accounts" concept (Bills Account, Groceries, Joint Spending, ...) with name and colour, managed in its own tab.
- Each bill gets an optional Account alongside its existing Bill Type — the two stay separate dimensions.
- Bills with no account group under "Unassigned".

## Monthly summary rework
Top card for the selected pay period:
- Income total
- Outgoings total (all accounts combined)
- Difference (surplus/deficit), coloured green when positive, red when negative.

Below it, one collapsible row per account showing the account total and share of outgoings. Expanding an account reveals its bills (grouped by bill type where present) with payment counts and amounts. Existing month navigation and 27th–26th pay period logic stay unchanged.

## Technical notes
- Migration:
  - `bills`: add `custom_count integer`, `expiry_date date`, `account_id uuid references bill_accounts(id)`; allow `frequency = 'custom'`.
  - New `bill_accounts` (id, name, color, sort_order, created_at) and `incomes` (id, name, amount, active, expiry_date, timestamps), each with explicit `GRANT`s matching the open policy style used by the existing bills tables, RLS enabled, and policies mirroring `bills`.
- `src/types/bill.ts`: add `'custom'` to `BillFrequency`, new fields, plus `BillAccount` and `Income` types.
- `src/utils/billCalculations.ts`: handle `custom` (count x amount), apply expiry filtering in `calculateBillTotalForPayPeriod`, and add income/difference aggregation to `calculatePayPeriodTotal`.
- New hooks `useBillAccounts.ts` and `useIncomes.ts` following the `useBillTypes` pattern.
- UI: `BillForm` gains frequency `custom` + count input, expiry date, account select; new `BillAccountManager.tsx` and `IncomeManager.tsx`; `MonthlySummary.tsx` rebuilt around income vs outgoings with collapsible accounts; `BillsPage` tabs become Bills, Summary, Income, Accounts, Types.
