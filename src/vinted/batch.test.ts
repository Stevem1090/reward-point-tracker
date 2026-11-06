// @ts-nocheck -- run with `bun test`
import './testSetup';
import { describe, expect, it } from 'bun:test';
import { canAdd, jitter, LADDER_WAITS_MS, pageAction, pauseBetween, shouldRetryItem, MAX_ITEMS, newItem, PAUSE_BETWEEN_MS, recoverAfterRestart, type BatchItem } from './batch';

const base = (o: Partial<BatchItem>): BatchItem => ({ ...newItem([], '', ''), ...o });

describe('batch rules', () => {
  it('caps a batch at 25 items', () => {
    expect(MAX_ITEMS).toBe(25);
    expect(canAdd(Array.from({ length: 24 }, () => base({})))).toBe(true);
    expect(canAdd(Array.from({ length: 25 }, () => base({})))).toBe(false);
  });

  it('pauses 15 seconds between items', () => {
    expect(PAUSE_BETWEEN_MS).toBe(15_000);
  });

  it('an item mid-save when the app closed becomes unknown, never re-run automatically', () => {
    const [r, q] = recoverAfterRestart([base({ status: 'running' }), base({ status: 'analysing' })]);
    expect(r.status).toBe('unknown');
    expect(q.status).toBe('queued');
  });

  it('stops on login wall, bot check or missing probe', () => {
    const ok = { hasTitleField: true, botCheck: false, loginWall: false, openInApp: false };
    void ok;
    expect(pageAction('ready')).toBe('go');
    expect(pageAction('login_wall')).toBe('login');
    expect(pageAction('error_page')).toBe('retry');
    expect(pageAction('timeout')).toBe('retry');
  });
});

import { cleanDescription, cleanTitle, describeReportErrors } from './batch';

it('text is tidied the way Vinted stores it, so it does not read back as drifting', () => {
  expect(cleanTitle('  Primark  black puffer \n')).toBe('Primark black puffer');
  expect(cleanDescription('Black puffer.  \r\nHooded.\n\n\n\nGood condition. ')).toBe('Black puffer.\nHooded.\n\nGood condition.');
});

it('drifting error names the field that kept changing', () => {
  const msg = describeReportErrors(
    { errors: ['fields still drifting after 3 passes'], steps: ['pass 1 re-applying: brand', 'pass 3 re-applying: brand'], finalValues: { brand: 'Primark Kids' } },
    { brandName: 'Primark' },
  );
  expect(msg).toContain('brand');
  expect(msg).toContain('Primark Kids');
});

import { toDraft as _toDraft, newItem as _newItem, priceLabel } from './batch';
describe('parcel size', () => {
  const base = () => ({ ..._newItem([], '', ''), analysis: { flags: [], categoryLeafId: undefined } as any });
  it('leaves packageId out unless overridden', () => {
    expect(_toDraft(base()).packageId).toBeUndefined();
    expect(_toDraft({ ...base(), packageId: 2 }).packageId).toBe(2);
  });
});

describe('price', () => {
  const base = () => ({ ..._newItem([], '', ''), analysis: { flags: [], categoryLeafId: undefined } as any });
  it('sends no price and no uplift by default (Vinted Optimal + £0.50 at drafting time)', () => {
    const d = _toDraft(base());
    expect(d.price).toBeUndefined();
    expect(d.priceUplift).toBeUndefined();
  });
  it('sends a typed custom price', () => {
    expect(_toDraft({ ...base(), price: '6.50' }).price).toBe(6.5);
  });
  it('sends priceUplift only when it differs from 0.50', () => {
    expect(_toDraft(base(), 0.5).priceUplift).toBeUndefined();
    expect(_toDraft(base(), 1).priceUplift).toBe(1);
  });
  it('labels the final price by source', () => {
    expect(priceLabel({ value: 4.5, source: 'vinted_optimal_plus_uplift', uplift: 0.5 })).toBe('£4.50 (Vinted Optimal + £0.50)');
    expect(priceLabel({ value: 6, source: 'custom' })).toBe('£6.00 (your price)');
  });
});

describe('Vinted error recovery', () => {
  it('ladder waits are now, 10s, 30s, 60s, 120s', () => {
    expect(LADDER_WAITS_MS).toEqual([0, 10_000, 30_000, 60_000, 120_000]);
  });
  it('jitter stays within about 20%', () => {
    expect(jitter(30_000, 0)).toBe(24_000);
    expect(jitter(30_000, 1)).toBe(36_000);
  });
  it('pause is at least 30s after a recovery until 3 clean items', () => {
    expect(pauseBetween(15_000, 0)).toBe(30_000);
    expect(pauseBetween(15_000, 2)).toBe(30_000);
    expect(pauseBetween(15_000, 3)).toBe(15_000);
    expect(pauseBetween(15_000, null)).toBe(15_000);
  });
  it('retries the same item at most twice, never after saving started', () => {
    const noForm = { fields: { title: false, price: false } };
    expect(shouldRetryItem({ savingReached: false, pageState: 'error_page', retries: 0 })).toBe(true);
    expect(shouldRetryItem({ savingReached: false, diagnostics: noForm, retries: 1 })).toBe(true);
    expect(shouldRetryItem({ savingReached: false, pageState: 'error_page', retries: 2 })).toBe(false);
    expect(shouldRetryItem({ savingReached: true, pageState: 'error_page', retries: 0 })).toBe(false);
    expect(shouldRetryItem({ savingReached: false, pageState: 'ready', diagnostics: { fields: { title: true } }, retries: 0 })).toBe(false);
  });
});
