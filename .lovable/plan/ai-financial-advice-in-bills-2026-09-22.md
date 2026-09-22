# AI Financial Advice in Bills

Add an AI adviser to the Monthly Summary that reviews your income, outgoings and account balances (including credit cards as negative balances) and returns a prioritised UK-focused action plan.

## 1. Accounts get balances

The Accounts tab gains extra fields per account:

- Account type: Current / Savings / Credit card
- Current balance (for credit cards this is the amount owed, treated as negative)
- Credit cards only: credit limit, interest rate (APR), and 0% promo end date

The accounts list shows each balance, with credit cards displayed in red as a negative, plus a small net position total (cash minus card debt) at the top.

## 2. "Get AI advice" in Monthly Summary

- A new card at the bottom of the Monthly Summary with a "Get AI advice" button.
- Tapping it opens a panel with a free-text box for extra context (upcoming events, birthdays, goals, savings plans, anything else worth knowing).
- On submit, the app sends: the selected pay period's income list, the full outgoings breakdown by account and bill type, the surplus/shortfall, every account balance with card rates and promo dates, and the user's extra context.
- The reply streams in live and is shown as formatted, readable sections (headings, bullets and the priority table), with buttons to copy it or save it as a PDF using the existing export setup.
- Each run is saved so you can reopen the latest advice without re-running it, and re-run whenever you want.

## 3. The prompt

The wealth-strategist prompt you supplied is used verbatim as the system instructions, with one change: instead of an attached PDF, the financial data is passed as a structured summary in the message, and the prompt is adjusted to say the figures come from that summary rather than an uploaded file. The required output format (Executive Summary, sections 1-4 with the action matrix table, and exactly 2 follow-up questions) is kept exactly as written.

The output is advisory only, so a short "this is not regulated financial advice" line appears under the result.

## Technical notes

- Migration on `public.bill_accounts`: add `account_kind text not null default 'current'` (check constraint current/savings/credit_card), `current_balance numeric default 0`, `credit_limit numeric`, `apr numeric`, `promo_end_date date`. Existing rows default to current accounts with a zero balance.
- New table `public.financial_advice_runs` (id, created_at, period_label, context_note, summary_snapshot jsonb, advice_markdown text) with explicit GRANTs to `authenticated`/`service_role`, RLS enabled matching the existing bills policy style.
- New edge function `financial-advice` (`verify_jwt = true`) calling Lovable AI Gateway `openai/gpt-6-astra` on `/v1/responses` with streaming, reasoning effort `medium`, `store: false`; the function streams text back to the client.
- Client: `useBillAccounts` extended for the new fields; new `FinancialAdviceCard` component in `src/components/bills/`; a small `buildFinancialSnapshot` helper in `billCalculations.ts` that serialises the `PayPeriodSummary` plus accounts into the payload.
- Add `react-markdown` to render the response; PDF export reuses `jspdf` in `billExport.ts`.
