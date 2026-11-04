// @ts-nocheck -- run with `bun test`
import { describe, it, expect } from 'bun:test';
import { applyPricing, matchRule, roundPrice, categoryType } from './pricing';
import { normaliseAnalysis } from './analysis';
import { validateForApproval } from './validate';
import { buildTestItem } from './testItem';

// Find a hoodie leaf from the reference instead of hardcoding IDs
import ref from './vinted-reference-kids.json';
const hoodieLeaf = Number(Object.keys(ref.categories.find((g) => g.group === 'Kids > Girls clothing > Jumpers & hoodies').leaves)[0]);
const NEXT = 2287;

const rules = [
  { id: 'f', categoryType: null, brandId: null, price: 3 },
  { id: 'h', categoryType: 'Jumpers & hoodies', brandId: NEXT, price: 6 },
  { id: 's', categoryType: 'Shoes', brandId: null, price: 4 },
];

describe('pricing rules', () => {
  it('category type ignores gender', () => expect(categoryType(hoodieLeaf)).toBe('Jumpers & hoodies'));
  it('Next hoodie matches the £6 rule', () => expect(matchRule(rules, hoodieLeaf, NEXT).price).toBe(6));
  it('other brand hoodie falls back to £3', () => expect(matchRule(rules, hoodieLeaf, 7).id).toBe('f'));
  it('AI cannot move a rule price by more than £1', () => {
    expect(applyPricing(rules, hoodieLeaf, NEXT, { suggestedPrice: 12, priceRationale: '', priceConfidence: 'low' }).suggestedPrice).toBe(7);
    expect(applyPricing(rules, hoodieLeaf, NEXT, { suggestedPrice: 1, priceRationale: '', priceConfidence: 'low' }).suggestedPrice).toBe(5);
  });
  it('no specific rule means low confidence', () => {
    expect(applyPricing(rules, hoodieLeaf, 7, { suggestedPrice: 5, priceRationale: 'x', priceConfidence: 'high' }).priceConfidence).toBe('low');
  });
  it('prices round to 50p steps', () => expect(roundPrice(4.3)).toBe(4.5));
});

describe('approval', () => {
  const item = buildTestItem('t', [{ name: 'a.jpg', type: 'image/jpeg', base64: 'x' }]);
  it('blocks an unconfirmed price', () => expect(validateForApproval(item, { priceConfirmed: false })).toContain('Price must be confirmed'));
  it('allows a confirmed price', () => expect(validateForApproval(item, { priceConfirmed: true })).toEqual([]));
  it('blocks flawed underwear', () => expect(validateForApproval(item, { priceConfirmed: true, flags: ['cannot_list_underwear'] })).toContain('Underwear with wear or flaws cannot be listed'));
  it('underwear not new with tags gets the block flag', () => {
    const a = normaliseAnalysis({ categoryLeafId: '1602', conditionId: '2', suggestedPrice: 3 }, rules);
    expect(a.flags).toContain('cannot_list_underwear');
  });
});
