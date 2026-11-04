import { describe, expect, it } from 'bun:test';
import { acceptAllPrices, blockerFor, canAdd, MAX_ITEMS, newItem, recoverAfterRestart, type BatchItem } from './batch';

const base = (o: Partial<BatchItem>): BatchItem => ({ ...newItem([], '', ''), ...o });

describe('batch rules', () => {
  it('caps a batch at 25 items', () => {
    expect(MAX_ITEMS).toBe(25);
    expect(canAdd(Array.from({ length: 24 }, () => base({})))).toBe(true);
    expect(canAdd(Array.from({ length: 25 }, () => base({})))).toBe(false);
  });

  it('accept all prices only confirms unconfirmed items awaiting review', () => {
    const a = { suggestedPrice: 4 } as any;
    const out = acceptAllPrices([
      base({ status: 'needs_review', analysis: a, price: '9' }),
      base({ status: 'drafted', analysis: a, price: '9' }),
    ]);
    expect(out[0]).toMatchObject({ price: '4', priceConfirmed: true });
    expect(out[1]).toMatchObject({ price: '9', priceConfirmed: false });
  });

  it('an item mid-save when the app closed becomes unknown, never re-run automatically', () => {
    const [r, q] = recoverAfterRestart([base({ status: 'running' }), base({ status: 'analysing' })]);
    expect(r.status).toBe('unknown');
    expect(q.status).toBe('queued');
  });

  it('stops on login wall, bot check or missing probe', () => {
    const ok = { hasTitleField: true, botCheck: false, loginWall: false, openInApp: false };
    expect(blockerFor(ok)).toBeNull();
    expect(blockerFor({ ...ok, loginWall: true })).not.toBeNull();
    expect(blockerFor({ ...ok, botCheck: true })).not.toBeNull();
    expect(blockerFor(null)).not.toBeNull();
  });
});
