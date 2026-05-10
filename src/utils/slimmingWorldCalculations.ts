import {
  HealthyExtraType,
  HEALTHY_EXTRA_TYPES,
  SwLogEntry,
  DailyTotals,
} from '@/types/slimmingWorld';

/**
 * Compute daily totals applying healthy-extra → swips conversion rules.
 *
 * Rule: For each healthy extra type, sum HE amounts in the order entries were
 * logged. The first cumulative 1.0 of a type counts as the Healthy Extra
 * (decimals stack — 0.5 + 0.5 = one HE). Anything above 1.0 converts to swips
 * proportionally using that entry's own swips value.
 */
export function computeDailyTotals(entries: SwLogEntry[]): DailyTotals {
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const heUsed: Record<HealthyExtraType, number> = {
    calcium: 0,
    fibre: 0,
    healthy_fats: 0,
  };

  let totalSwips = 0;
  let speedCount = 0;

  for (const e of sortedEntries) {
    const qty = Number(e.quantity ?? 1);
    const baseSwips = Number(e.swips_snapshot ?? 0);
    const heType = e.healthy_extra_type_snapshot;
    const heAmount = Number(e.healthy_extra_amount_snapshot ?? 0) * qty;
    const entrySwips = baseSwips * qty;

    if (e.is_speed_snapshot) speedCount += 1;

    if (heType && heAmount > 0) {
      const remainingHe = Math.max(0, 1 - heUsed[heType]);
      const heUsable = Math.min(heAmount, remainingHe);
      const heOverflow = heAmount - heUsable;
      heUsed[heType] = Math.min(1, heUsed[heType] + heUsable);

      // Whole entry: HE counts (no swips) when entirely within limit; otherwise
      // the overflow portion contributes its proportional swip cost.
      if (heAmount > 0) {
        const overflowFraction = heOverflow / heAmount;
        totalSwips += entrySwips * overflowFraction;
      } else {
        totalSwips += entrySwips;
      }
    } else {
      totalSwips += entrySwips;
    }
  }

  return {
    swips: round1(totalSwips),
    healthyExtras: heUsed,
    speedCount,
  };
}

/**
 * For a single entry (in chronological context), returns true if its HE amount
 * exceeds the remaining daily allowance and was therefore counted as swips.
 */
export function entryOverflowed(entry: SwLogEntry, allEntries: SwLogEntry[]): boolean {
  if (!entry.healthy_extra_type_snapshot) return false;
  const sorted = [...allEntries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let used = 0;
  for (const e of sorted) {
    if (e.healthy_extra_type_snapshot !== entry.healthy_extra_type_snapshot) continue;
    const amt = Number(e.healthy_extra_amount_snapshot ?? 0) * Number(e.quantity ?? 1);
    if (e.id === entry.id) {
      const remaining = Math.max(0, 1 - used);
      return amt > remaining;
    }
    used = Math.min(1, used + amt);
  }
  return false;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export const ALL_HE_TYPES = HEALTHY_EXTRA_TYPES;
