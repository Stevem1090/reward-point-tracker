// @ts-nocheck -- run with `bun test`
import './testSetup';
import { describe, expect, it } from 'bun:test';
import { approvalErrors, newItem, toDraft } from './batch';

const analysis = (brandStatus, brandId = null) => ({
  title: 'Black puffer jacket', description: 'x', categoryLeafId: null, brandNameRead: null, brandId, brandStatus,
  sizeId: null, sizeEvidence: '', conditionId: 2, conditionReason: '', notesUsed: [], colourIds: [], materialIds: [],
  confidence: {}, flags: [],
});
const item = (o) => ({ ...newItem([], '', ''), status: 'needs_review', price: '3', ...o });
const brandErr = (it) => approvalErrors(it).filter((e) => /brand/i.test(e));

describe('brand rules', () => {
  it('none_visible goes through as "List without brand"', () => {
    const it = item({ analysis: analysis('none_visible'), brandId: null });
    expect(toDraft(it).noBrand).toBe(true);
    expect(brandErr(it)).toEqual([]);
  });
  it('not_in_list cannot be approved until fixed', () => {
    const it = item({ analysis: analysis('not_in_list'), brandId: null });
    expect(toDraft(it).noBrand).toBeUndefined();
    expect(brandErr(it).length).toBeGreaterThan(0);
  });
  it('not_in_list is fixed by confirming "No brand"', () => {
    const it = item({ analysis: analysis('not_in_list'), brandId: null, noBrand: true });
    expect(toDraft(it).noBrand).toBe(true);
    expect(brandErr(it)).toEqual([]);
  });
  it('not_in_list is fixed by picking a brand', () => {
    const it = item({ analysis: analysis('not_in_list'), brandId: 0, brandName: 'Mothercare' });
    expect(toDraft(it)).toMatchObject({ brandId: 0, brandName: 'Mothercare' });
    expect(brandErr(it)).toEqual([]);
  });
});
