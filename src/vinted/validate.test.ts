import { describe, it, expect } from 'vitest';
import { validateDraft, type DraftItem } from './validate';
import { buildTestItem } from './testItem';

const img = [{ name: 'a.jpg', type: 'image/jpeg' as const, base64: 'x' }];
const good = (): DraftItem => buildTestItem('t1', img) as DraftItem;

describe('validateDraft', () => {
  it('accepts the built-in test item', () => expect(validateDraft(good())).toEqual([]));
  it('blocks a zero price', () => expect(validateDraft({ ...good(), price: 0 })).toContain('Price must be more than £0'));
  it('blocks more than two colours', () => expect(validateDraft({ ...good(), colourIds: [1, 3, 12] })).toContain('At most 2 colours'));
  it('blocks a brand outside the list', () => expect(validateDraft({ ...good(), brandId: 999999 })).toContain('Brand is missing or not in the brand list'));
  it('blocks a mismatched brand name', () => expect(validateDraft({ ...good(), brandName: 'TU' })).toContain('Brand name does not match the brand'));
  it('blocks no photos', () => expect(validateDraft({ ...good(), images: [] })).toContain('At least one photo is needed'));
  it('blocks a wrong category path', () => expect(validateDraft({ ...good(), categoryPath: [1193] })).toContain('Category path does not match the category'));
  it('blocks underwear that is not new with tags', () => {
    const e = validateDraft({ ...good(), categoryLeafId: 1602, categoryPath: [1193, 1195, 1245], conditionId: 2 });
    expect(e).toContain('Underwear can only be "New with tags"');
  });
  it('blocks a size on a category with no size field', () => {
    const e = validateDraft({ ...good(), categoryLeafId: 1258, categoryPath: [1193, 1195] });
    expect(e).toContain('This category has no size, so size must be empty');
  });
  it('blocks all-capitals title words', () => expect(validateDraft({ ...good(), title: 'NEXT navy skirt' }).some((x) => x.startsWith('Title has'))).toBe(true));
});
