import { describe, expect, it } from 'bun:test';
import { CommittedItem, groupTotals, periodTotals, currentPayPeriodKey } from './committedSpending';

const item = (p: Partial<CommittedItem>): CommittedItem => ({
  id: Math.random().toString(), parent_id: null, name: 'x', estimate_min: null, estimate_max: null,
  is_range: false, actual_amount: null, is_complete: false, sort_order: 0, account_id: null, pay_period: '2026-11', ...p,
});

describe('committed spending left to spend', () => {
  it('open item leaves estimate minus actual', () => {
    const t = item({ estimate_min: 100, actual_amount: 40 });
    expect(groupTotals(t, [t]).left).toEqual({ min: 60, max: 60 });
  });
  it('completed item leaves nothing even if under estimate', () => {
    const t = item({ estimate_min: 100, actual_amount: 40, is_complete: true });
    expect(groupTotals(t, [t]).left).toEqual({ min: 0, max: 0 });
  });
  it('overspent line leaves 0, not negative', () => {
    const t = item({ estimate_min: 50, actual_amount: 80 });
    expect(groupTotals(t, [t]).left.min).toBe(0);
  });
  it('range estimate £30-60 gives range left', () => {
    const t = item({ estimate_min: 30, estimate_max: 60, is_range: true, actual_amount: 10 });
    expect(groupTotals(t, [t]).left).toEqual({ min: 20, max: 50 });
  });
  it('sub-lines sum to the group', () => {
    const top = item({ id: 'top' });
    const a = item({ parent_id: 'top', estimate_min: 40, actual_amount: 50 });
    const b = item({ parent_id: 'top', estimate_min: 20 });
    const g = groupTotals(top, [top, a, b]);
    expect(g.estimate.min).toBe(60);
    expect(g.actual).toBe(50);
    expect(g.left.min).toBe(20);
    expect(periodTotals([top, a, b]).left.min).toBe(20);
  });
  it('pay period rolls on the 27th', () => {
    expect(currentPayPeriodKey(new Date(2026, 10, 26))).toBe('2026-11');
    expect(currentPayPeriodKey(new Date(2026, 10, 27))).toBe('2026-12');
  });
});
