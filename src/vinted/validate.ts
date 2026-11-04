import { VINTED_REFERENCE as ref, findLeaf, sizeGroupForLeaf } from './reference';

export type DraftItem = {
  itemId: string;
  images: { name: string; type: string; base64: string }[];
  title: string;
  description: string;
  categoryPath: number[];
  categoryLeafId: number;
  brandId: number;
  brandName: string;
  sizeId: number | null;
  conditionId: number;
  colourIds: number[];
  materialIds: number[];
  price: number;
  packageId: 1 | 2 | 3;
};

const has = (o: Record<string, unknown>, id: unknown) => id != null && Object.prototype.hasOwnProperty.call(o, String(id));
const sizeGroups = ref.sizeGroups as Record<string, { options: Record<string, string> }>;
const condEx = ref.conditions.exceptions.onlyNewWithTags;

/** Words of 3+ capital letters (Vinted rejects titles with too many capitals). */
export const capsWords = (s: string) => (s.match(/\b[A-Z]{3,}\b/g) ?? []);

export function allowedConditions(leafId: number): Record<string, string> {
  return condEx.leaves.includes(String(leafId)) ? condEx.options : ref.conditions.default;
}

export function sizeOptionsForLeaf(leafId: number): Record<string, string> | null {
  const g = sizeGroupForLeaf(leafId);
  return g ? sizeGroups[g]?.options ?? {} : null;
}

/** Hard validation. Returns a list of blocking errors; empty means safe to send. */
export function validateDraft(item: Partial<DraftItem>): string[] {
  const e: string[] = [];
  const leaf = item.categoryLeafId != null ? findLeaf(item.categoryLeafId) : null;
  if (!leaf) e.push('Category is missing or not a Kids clothing category');
  else if (JSON.stringify(item.categoryPath) !== JSON.stringify(leaf.pick)) e.push('Category path does not match the category');

  if (leaf) {
    const sizes = sizeOptionsForLeaf(leaf.id);
    if (sizes === null) { if (item.sizeId != null) e.push('This category has no size, so size must be empty'); }
    else if (!has(sizes, item.sizeId)) e.push('Size is missing or not valid for this category');

    if (!has(allowedConditions(leaf.id), item.conditionId)) {
      e.push(condEx.leaves.includes(String(leaf.id)) ? 'Underwear can only be "New with tags"' : 'Condition is missing or not valid');
    }
  } else if (!has(ref.conditions.default, item.conditionId)) e.push('Condition is missing or not valid');

  const main = ref.brands.main as Record<string, string>;
  if (item.brandId === 0) { if (!String(item.brandName ?? '').trim()) e.push('Type the custom brand name'); }
  else if (!has(main, item.brandId)) e.push('Brand is missing or not in the brand list');
  else if (main[String(item.brandId)] !== item.brandName) e.push('Brand name does not match the brand');

  const colours = item.colourIds ?? [];
  if (colours.length > ref.colours.maxSelectable) e.push(`At most ${ref.colours.maxSelectable} colours`);
  if (colours.some((c) => !has(ref.colours.options, c))) e.push('Unknown colour');
  if ((item.materialIds ?? []).some((m) => !has(ref.materials.options, m))) e.push('Unknown material');

  if (!(typeof item.price === 'number' && Number.isFinite(item.price) && item.price > 0)) e.push('Price must be more than £0');
  if (!item.images?.length) e.push('At least one photo is needed');
  if (![1, 2, 3].includes(item.packageId as number)) e.push('Package size must be Small, Medium or Large');

  const title = (item.title ?? '').trim();
  if (!title) e.push('Title is missing');
  else if (capsWords(title).length) e.push(`Title has all-capitals words (${capsWords(title).join(', ')})`);
  if (!(item.description ?? '').trim()) e.push('Description is missing');
  return e;
}

/**
 * Approval gate: hard validation plus human checks. Nothing is sent with an unconfirmed price,
 * and worn or flawed underwear can never be listed.
 */
export function validateForApproval(item: Partial<DraftItem>, opts: { priceConfirmed: boolean; flags?: string[] }): string[] {
  const e = validateDraft(item);
  if (!opts.priceConfirmed) e.push('Price must be confirmed');
  if (opts.flags?.includes('cannot_list_underwear')) e.push('Underwear with wear or flaws cannot be listed');
  return e;
}
