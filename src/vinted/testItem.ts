import { VINTED_REFERENCE as ref, findLeaf, sizeGroupForLeaf, idByName } from './reference';
import type { VintedImage } from './imageResize';

/** Built-in dry-run item. Every ID is looked up from the reference JSON by name. */
export function buildTestItem(itemId: string, images: VintedImage[]) {
  const girls = ref.categories.find((c) => c.group === 'Kids > Girls clothing')!;
  const leafId = idByName(girls.leaves as Record<string, string>, 'Skirts');
  const leaf = findLeaf(leafId)!;
  const sizeGroup = sizeGroupForLeaf(leafId);
  const sizeOptions = sizeGroup
    ? ((ref.sizeGroups as Record<string, { options: Record<string, string> }>)[sizeGroup].options)
    : null;
  const sizeEntry = sizeOptions ? Object.entries(sizeOptions).find(([, n]) => /4-5 years/i.test(n)) ?? Object.entries(sizeOptions)[0] : null;

  return {
    itemId,
    images,
    title: 'Navy cotton skirt',
    description: 'Diagnostics test item. Dry run only, not for sale.',
    categoryPath: leaf.pick,
    categoryLeafId: leaf.id,
    brandId: idByName(ref.brands.main, 'Next'),
    brandName: 'Next',
    sizeId: sizeEntry ? Number(sizeEntry[0]) : null,
    conditionId: idByName(ref.conditions.default, 'Very good'),
    colourIds: [idByName(ref.colours.options, 'Navy')],
    materialIds: [idByName(ref.materials.options, 'Cotton')],
    price: 3,
    packageId: 1 as const,
  };
}
