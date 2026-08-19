# Group bills by type inside each account

Inside each account accordion on the Summary tab, bills will be grouped by bill type (Subscriptions, Energy, etc.) with a subtotal per type, instead of one flat list.

## Layout

```text
Bills Account                        £1,240.00 (68%)
  Energy                                 £180.00
    Electricity                           £95.00
    Gas                                   £85.00
  Subscriptions                           £42.99
    Netflix                               £12.99
    Spotify                               £11.00
    ...
  Uncategorised                          £120.00
```

- Type rows show name, a small colour dot from the bill type colour, and the subtotal.
- Bills without a type fall into an "Uncategorised" group, listed last.
- Type groups sort by total (highest first); bills within a group keep their current order.
- Bills not due in the period still show under their type with the "Not due this period" note.

## Technical notes

- Add a `typeBreakdowns` array (`typeId`, `typeName`, `typeColor`, `total`, `calculations`) to `AccountBreakdown` in `src/types/bill.ts`.
- Build it in `src/utils/billCalculations.ts` where account breakdowns are assembled; keep `calculations` on the account for backwards compatibility.
- Render the grouped view in `MonthlySummary.tsx` inside the existing collapsible account content.
- Include the type grouping and subtotals in the CSV and PDF exports in `src/utils/billExport.ts`.
