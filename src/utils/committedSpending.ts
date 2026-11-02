export interface CommittedItem {
  id: string;
  parent_id: string | null;
  name: string;
  estimate_min: number | null;
  estimate_max: number | null;
  is_range: boolean;
  actual_amount: number | null;
  is_complete: boolean;
  sort_order: number;
  account_id: string | null;
  pay_period: string;
}

export interface Range { min: number; max: number }

const n = (v: number | null | undefined) => Number(v ?? 0) || 0;

/** Estimate of a single line: single number uses estimate_min for both ends. */
export const lineEstimate = (i: CommittedItem): Range => {
  const min = n(i.estimate_min);
  const max = i.is_range ? n(i.estimate_max ?? i.estimate_min) : min;
  return { min, max: Math.max(min, max) };
};

const leaves = (top: CommittedItem, all: CommittedItem[]) => {
  const kids = all.filter((c) => c.parent_id === top.id);
  return kids.length ? kids : [top];
};

export interface GroupTotals { estimate: Range; actual: number; left: Range }

/** True when the top line carries its own budget and sub-lines just record spend. */
export const usesToplineBudget = (top: CommittedItem, all: CommittedItem[]) =>
  top.estimate_min != null && all.some((c) => c.parent_id === top.id);

/** Totals for a top-level commitment. Completed = nothing left; overspent lines leave 0. */
export const groupTotals = (top: CommittedItem, all: CommittedItem[]): GroupTotals => {
  const ls = leaves(top, all);
  if (usesToplineBudget(top, all)) {
    const estimate = lineEstimate(top);
    const actual = ls.reduce((s, l) => s + n(l.actual_amount), 0);
    const left = top.is_complete
      ? { min: 0, max: 0 }
      : { min: Math.max(0, estimate.min - actual), max: Math.max(0, estimate.max - actual) };
    return { estimate, actual, left };
  }
  const estimate = { min: 0, max: 0 };
  const left = { min: 0, max: 0 };
  let actual = 0;
  for (const l of ls) {
    const e = lineEstimate(l);
    const a = n(l.actual_amount);
    estimate.min += e.min;
    estimate.max += e.max;
    actual += a;
    if (!top.is_complete) {
      left.min += Math.max(0, e.min - a);
      left.max += Math.max(0, e.max - a);
    }
  }
  return { estimate, actual, left };
};

export const periodTotals = (all: CommittedItem[]): GroupTotals => {
  const out: GroupTotals = { estimate: { min: 0, max: 0 }, actual: 0, left: { min: 0, max: 0 } };
  for (const top of all.filter((i) => !i.parent_id)) {
    const g = groupTotals(top, all);
    out.estimate.min += g.estimate.min;
    out.estimate.max += g.estimate.max;
    out.actual += g.actual;
    out.left.min += g.left.min;
    out.left.max += g.left.max;
  }
  return out;
};

const gbp = (v: number) => `£${v.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const formatRange = (r: Range) => (r.min === r.max ? gbp(r.min) : `${gbp(r.min)}–${gbp(r.max)}`);
export const formatGBP = gbp;

/** Pay period key "YYYY-MM" for the month the 27th–26th period ends in. */
export const currentPayPeriodKey = (d = new Date()) => {
  const end = d.getDate() >= 27 ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : d;
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
};
export const shiftPeriod = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const periodLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(y, m - 2, 27);
  const end = new Date(y, m - 1, 26);
  const f = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${f(start)} – ${f(end)}`;
};
