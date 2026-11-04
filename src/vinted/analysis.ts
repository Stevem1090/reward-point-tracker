import aiReference from './vinted-reference-kids-for-ai.txt?raw';
import { VINTED_REFERENCE as ref, findLeaf } from './reference';
import type { DraftItem } from './validate';
import { supabase } from '@/integrations/supabase/client';

type Confidence = 'low' | 'medium' | 'high';
export type Analysis = {
  title: string;
  description: string;
  categoryLeafId: number | null;
  brandNameRead: string | null;
  brandId: number | null;
  sizeId: number | null;
  sizeEvidence: string;
  conditionId: number | null;
  colourIds: number[];
  materialIds: number[];
  price: null;
  confidence: Record<string, Confidence>;
  flags: string[];
};

const leafIds = (ref.categories as { leaves: Record<string, string> }[]).flatMap((g) => Object.keys(g.leaves));
const allSizeIds = [...new Set(Object.values(ref.sizeGroups as Record<string, { options: Record<string, string> }>).flatMap((g) => Object.keys(g.options)))];
const conf = { type: 'string', enum: ['low', 'medium', 'high'] };
const nullableEnum = (ids: string[]) => ({ type: ['string', 'null'], enum: [...ids, null] });

/** JSON schema whose ID fields are enums built from the reference JSON (IDs as strings). */
export function analysisSchema() {
  const fields = ['title', 'description', 'category', 'brand', 'size', 'condition', 'colours', 'materials'];
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'description', 'categoryLeafId', 'brandNameRead', 'brandId', 'sizeId', 'sizeEvidence', 'conditionId', 'colourIds', 'materialIds', 'price', 'confidence', 'flags'],
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      categoryLeafId: { type: 'string', enum: leafIds },
      brandNameRead: { type: ['string', 'null'] },
      brandId: nullableEnum(Object.keys(ref.brands.main)),
      sizeId: nullableEnum(allSizeIds),
      sizeEvidence: { type: 'string' },
      conditionId: { type: 'string', enum: Object.keys(ref.conditions.default) },
      colourIds: { type: 'array', maxItems: 2, items: { type: 'string', enum: Object.keys(ref.colours.options) } },
      materialIds: { type: 'array', items: { type: 'string', enum: Object.keys(ref.materials.options) } },
      price: { type: 'null' },
      confidence: { type: 'object', additionalProperties: false, required: fields, properties: Object.fromEntries(fields.map((f) => [f, conf])) },
      flags: { type: 'array', items: { type: 'string' } },
    },
  };
}

export const ANALYSIS_RULES = `You write Vinted UK listings for second-hand KIDS clothing from photos. Use ONLY IDs from the reference below; never invent an ID.
- categoryLeafId: one leaf category ID. If the item is not kids clothing (women, men, adult sizes), still pick the closest leaf and add flag "not_kids".
- Brand: brandNameRead = the brand text you can read on a label (or null). brandId only if it is one of the ten main brands in the reference; otherwise brandId null and add flag "unknown_brand". Do not use sub-brand IDs.
- Size: use the printed AGE on the label (e.g. "4-5 years"), not cm. Choose a size from the size group of the chosen category. Put the label text you read in sizeEvidence. If no size label is readable or it only shows height, choose the closest and add flag "size_unclear". sizeId null ONLY for categories with no size field.
- Materials: only from a readable composition label; otherwise empty and flag "no_material_label".
- Colours: one or two, main colours only.
- Condition: your best guess from the photos; a human always confirms it. Underwear (leaves 1602, 1759) must be 6 (New with tags).
- price is always null. Never suggest a price.
- title: short, sentence case, e.g. "Navy cotton skirt age 4". Never write any word of 3+ letters in ALL CAPITALS (write "Next", not "NEXT").
- description: 1-3 short sentences with only facts visible in the photos or labels. No made-up measurements, no claims you can't see.
- confidence: low/medium/high per field. flags: short codes for anything a human must check.`;

const num = (v: unknown) => (v == null || v === '' ? null : Number(v));

export async function analysePhotos(images: { base64: string }[]): Promise<Analysis> {
  const { data, error } = await supabase.functions.invoke('vinted-analyse', {
    body: { images: images.map((i) => i.base64), schema: analysisSchema(), rules: ANALYSIS_RULES, reference: aiReference },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  const r = data.result;
  return {
    ...r,
    categoryLeafId: num(r.categoryLeafId),
    brandId: num(r.brandId),
    sizeId: num(r.sizeId),
    conditionId: num(r.conditionId),
    colourIds: (r.colourIds ?? []).map(Number).slice(0, 2),
    materialIds: (r.materialIds ?? []).map(Number),
    price: null,
    flags: [...(r.flags ?? []), 'confirm_condition'],
  };
}

/** Turn an AI analysis into a draft payload. Price comes from the human. */
export function analysisToDraft(a: Analysis, itemId: string, images: DraftItem['images'], price: number | null): Partial<DraftItem> {
  const leaf = a.categoryLeafId != null ? findLeaf(a.categoryLeafId) : null;
  const main = ref.brands.main as Record<string, string>;
  return {
    itemId,
    images,
    title: a.title,
    description: a.description,
    categoryLeafId: leaf?.id,
    categoryPath: leaf?.pick,
    brandId: a.brandId ?? undefined,
    brandName: a.brandId != null ? main[String(a.brandId)] : undefined,
    sizeId: a.sizeId,
    conditionId: a.conditionId ?? undefined,
    colourIds: a.colourIds,
    materialIds: a.materialIds,
    price: price ?? undefined,
    packageId: 1,
  };
}
