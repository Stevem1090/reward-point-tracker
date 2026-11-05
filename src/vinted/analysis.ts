import aiReference from './vinted-reference-kids-for-ai.txt?raw';
import { VINTED_REFERENCE as ref, findLeaf } from './reference';
import type { DraftItem } from './validate';
import { supabase } from '@/integrations/supabase/client';

type Confidence = 'low' | 'medium' | 'high';
export type BrandStatus = 'identified' | 'none_visible' | 'not_in_list';

export type Analysis = {
  title: string;
  description: string;
  categoryLeafId: number | null;
  brandNameRead: string | null;
  brandId: number | null;
  /** identified = brand from the list; none_visible = no brand anywhere; not_in_list = brand seen but not in the list. */
  brandStatus: BrandStatus;
  sizeId: number | null;
  sizeEvidence: string;
  conditionId: number | null;
  conditionReason: string;
  notesUsed: string[];
  colourIds: number[];
  materialIds: number[];
  confidence: Record<string, Confidence>;
  flags: string[];
};

const leafIds = (ref.categories as { leaves: Record<string, string> }[]).flatMap((g) => Object.keys(g.leaves));
const allSizeIds = [...new Set(Object.values(ref.sizeGroups as Record<string, { options: Record<string, string> }>).flatMap((g) => Object.keys(g.options)))];
const conf = { type: 'string', enum: ['low', 'medium', 'high'] };
const nullableEnum = (ids: string[]) => ({ type: ['string', 'null'], enum: [...ids, null] });
export const UNDERWEAR_LEAVES = ref.conditions.exceptions.onlyNewWithTags.leaves.map(Number);

/** JSON schema whose ID fields are enums built from the reference JSON (IDs as strings). */
export function analysisSchema() {
  const fields = ['title', 'description', 'category', 'brand', 'size', 'condition', 'colours', 'materials'];
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'description', 'categoryLeafId', 'brandNameRead', 'brandId', 'brandStatus', 'sizeId', 'sizeEvidence', 'conditionId', 'conditionReason', 'notesUsed', 'colourIds', 'materialIds', 'confidence', 'flags'],
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      categoryLeafId: { type: 'string', enum: leafIds },
      brandNameRead: { type: ['string', 'null'] },
      brandId: nullableEnum(Object.keys(ref.brands.main)),
      brandStatus: { type: 'string', enum: ['identified', 'none_visible', 'not_in_list'] },
      sizeId: nullableEnum(allSizeIds),
      sizeEvidence: { type: 'string' },
      conditionId: { type: 'string', enum: Object.keys(ref.conditions.default) },
      conditionReason: { type: 'string' },
      notesUsed: { type: 'array', items: { type: 'string' } },
      colourIds: { type: 'array', maxItems: 2, items: { type: 'string', enum: Object.keys(ref.colours.options) } },
      materialIds: { type: 'array', items: { type: 'string', enum: Object.keys(ref.materials.options) } },
      confidence: { type: 'object', additionalProperties: false, required: fields, properties: Object.fromEntries(fields.map((f) => [f, conf])) },
      flags: { type: 'array', items: { type: 'string' } },
    },
  };
}

export const ANALYSIS_RULES = `You write Vinted UK listings for second-hand KIDS clothing from photos and the seller's notes. Use ONLY IDs from the reference below; never invent an ID.
- categoryLeafId: one leaf category ID. If the item is not kids clothing (women, men, adult sizes), still pick the closest leaf and add flag "not_kids".
- Brand: brandNameRead = the brand text you can read on a label or the item (or null). Do not use sub-brand IDs. brandStatus:
  - "identified": a brand from the reference list is clearly shown on the label or item (or stated in the notes). Set brandId.
  - "none_visible": no brand is visible anywhere in the photos or notes. brandId null. The item will be listed without a brand.
  - "not_in_list": a brand IS visible but it is not in the reference list. brandId null, put what you read in brandNameRead, and add flag "unknown_brand".
- Size: use the printed AGE on the label (e.g. "4-5 years"), not cm. Choose a size from the size group of the chosen category. Put the label text you read in sizeEvidence. If no size label is readable or it only shows height, choose the closest and add flag "size_unclear". sizeId null ONLY for categories with no size field.
- Materials: only from a readable composition label; otherwise empty and flag "no_material_label".
- Colours: one or two, main colours only.

SELLER NOTES (may be empty):
- Every defect or fact in the notes MUST appear in the description, in plain honest words, in the final line. Never drop, soften or hide a defect. Never add defects that are not in the notes or clearly visible in the photos.
- notesUsed: the note facts you included, one short phrase each (empty if no notes).

CONDITION (IDs: 6 New with tags, 1 New without tags, 2 Very good, 3 Good, 4 Satisfactory):
- No notes and no visible flaws: normally 2. Use 6 or 1 only if tags or packaging are clearly visible.
- 6 only if tags are visible AND the notes mention no flaws. Any flaw means at most 2.
- Barely noticeable flaw (slight mark, light bobbling, worn once or twice): 2, or 3 if the flaw would be noticed.
- Visible mark or stain, noticeable wear or fading: 3.
- Significant stain, hole, tear, broken zip, missing button, heavy fading: 4.
- If the notes and photos disagree, add flag "notes_photos_disagree" and choose the lower condition.
- Underwear (leaves 1602 and 1759) only allows 6. If the notes or photos show any wear or flaw on underwear, still return 6 but add flag "cannot_list_underwear".
- conditionReason: one short sentence, e.g. "Downgraded to Good because the notes mention a mark on the front."

TITLE: short, sentence case, e.g. "Navy cotton skirt age 4". Never write any word of 3+ letters in ALL CAPITALS (write "Next", not "NEXT").

DESCRIPTION: plain text, 2 to 4 short lines separated by line breaks, about 25 to 60 words in total. No markdown, emojis, hashtags or all-caps. No invented details. No measurements unless on the label.
- Line 1: what it is (item type, brand, size as printed on the label), e.g. "Next girls floral zip-up hoodie, 12-18 months."
- Line 2: only features a buyer cares about (hood, zip, pockets, pattern). No fabric descriptions or marketing language.
- Line 3: composition if the label is readable, e.g. "85% cotton, 15% polyester." Leave this line out if not readable.
- Final line: condition and any flaws (from the notes or clearly visible in the photos).

confidence: low/medium/high per field. flags: short codes for anything a human must check.`;

const num = (v: unknown) => (v == null || v === '' ? null : Number(v));

export type AnalyseInput = { notes?: string; hints?: string; rules?: PricingRule[] };

export async function analysePhotos(images: { base64: string }[], input: AnalyseInput = {}): Promise<Analysis> {
  const rules = input.rules ?? loadRules();
  const { data, error } = await supabase.functions.invoke('vinted-analyse', {
    body: {
      images: images.map((i) => i.base64),
      schema: analysisSchema(),
      rules: ANALYSIS_RULES,
      reference: aiReference,
      notes: (input.notes ?? '').slice(0, 1000),
      hints: (input.hints ?? '').slice(0, 300),
      pricingRules: rulesForAI(rules),
    },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return normaliseAnalysis(data.result, rules);
}

/** Convert raw AI output (string IDs) into typed values and apply the seller's pricing rules. */
export function normaliseAnalysis(r: any, rules: PricingRule[]): Analysis {
  const leafId = num(r.categoryLeafId);
  const brandId = num(r.brandId);
  const brandStatus: BrandStatus = brandId != null ? 'identified'
    : r.brandStatus === 'none_visible' && !r.brandNameRead ? 'none_visible' : r.brandStatus === 'none_visible' ? 'not_in_list'
    : r.brandStatus === 'identified' ? (r.brandNameRead ? 'not_in_list' : 'none_visible') : 'not_in_list';
  const flags = new Set<string>([...(r.flags ?? []), 'confirm_condition']);
  let conditionId = num(r.conditionId);
  if (leafId != null && UNDERWEAR_LEAVES.includes(leafId) && conditionId !== 6) {
    flags.add('cannot_list_underwear');
    conditionId = 6;
  }
  const price = applyPricing(rules, leafId, brandId, {
    suggestedPrice: typeof r.suggestedPrice === 'number' ? r.suggestedPrice : null,
    priceRationale: r.priceRationale ?? '',
    priceConfidence: r.priceConfidence ?? 'low',
  });
  return {
    title: r.title ?? '',
    description: r.description ?? '',
    categoryLeafId: leafId,
    brandNameRead: r.brandNameRead ?? null,
    brandId,
    brandStatus,
    sizeId: num(r.sizeId),
    sizeEvidence: r.sizeEvidence ?? '',
    conditionId,
    conditionReason: r.conditionReason ?? '',
    notesUsed: r.notesUsed ?? [],
    colourIds: (r.colourIds ?? []).map(Number).slice(0, 2),
    materialIds: (r.materialIds ?? []).map(Number),
    suggestedPrice: price.suggestedPrice,
    priceRationale: price.priceRationale,
    priceConfidence: price.priceConfidence,
    confidence: r.confidence ?? {},
    flags: [...flags],
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
    noBrand: a.brandId == null && a.brandStatus === 'none_visible' ? true : undefined,
    sizeId: a.sizeId,
    conditionId: a.conditionId ?? undefined,
    colourIds: a.colourIds,
    materialIds: a.materialIds,
    price: price ?? undefined,
  };
}
