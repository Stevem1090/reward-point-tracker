import aiReference from './vinted-reference-kids-for-ai.txt?raw';
import { VINTED_REFERENCE as ref, findLeaf } from './reference';
import type { DraftItem } from './validate';
import { supabase } from '@/integrations/supabase/client';
import { WRITING_RULES } from './writing';
import writingExamples from './writing-examples.txt?raw';
import { validatePlan, type PhotoPlanEntry } from './photos';

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
  /** Validated photo order/rotation plan, or null if the AI's plan was invalid. */
  photos: PhotoPlanEntry[] | null;
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
    required: ['title', 'description', 'categoryLeafId', 'brandNameRead', 'brandId', 'brandStatus', 'sizeId', 'sizeEvidence', 'conditionId', 'conditionReason', 'notesUsed', 'colourIds', 'materialIds', 'confidence', 'flags', 'photos'],
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
      photos: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['photoId', 'role', 'rotateClockwiseDegrees', 'rotationConfidence', 'note'],
          properties: {
            photoId: { type: 'integer' },
            role: { type: 'string', enum: ['full_flat_lay', 'full_other', 'detail', 'flaw', 'label', 'other'] },
            rotateClockwiseDegrees: { type: 'integer', enum: [0, 90, 180, 270] },
            rotationConfidence: conf,
            note: { type: 'string' },
          },
        },
      },
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

${WRITING_RULES}

${writingExamples}

PHOTOS: the photos are labelled "Photo 1", "Photo 2", ... in the order the seller added them. Return "photos": one entry per photo, listed IN THE ORDER they should be uploaded (the first entry becomes the Vinted cover photo). photoId = that photo's number. note: 12 words or fewer.
Order the photos like this:
 a. FIRST: a flat lay showing the WHOLE item. If the listing is several items (for example 2 pairs of pyjamas, a bundle, a pair of shoes), the first photo is the one showing ALL of them together. Choose the clearest, best lit, fully in frame photo as the cover.
 b. If there are two full views (for example front and back), front first, then back.
 c. THEN detail shots (print, pocket, hood, buttons, zip, texture, a feature mentioned in the notes).
 d. THEN any photo showing a flaw, so a buyer sees it before the label. If the notes mention a flaw and a photo shows it, mark that photo role "flaw".
 e. LAST: the label (brand, size or care label).
 f. Shoes: whole pair first (side or top view), then sole and detail shots, then the size marking last.
 g. If there is no true full-item photo, use the best overall view first and flag "no_full_item_photo".
 Example: photos that arrive as [label, close-up, full item] must come back as [full item, close-up, label].
 Never drop, add or duplicate a photo. Every photoId appears exactly once. If two photos are near duplicates, keep both and flag "possible_duplicate_photo". If a photo shows a person, especially a child, flag "person_visible" (do not remove it). If a photo is blurry or obstructed, flag "photo_quality". If there is only one photo, there is nothing to order.
Rotation: each photo should be shown the way up it would be seen if the garment were laid out or worn the right way up: top of the garment at the TOP of the image.
 - T-shirts, tops, jumpers, hoodies, jackets, dresses: neckline or hood at the top, hem at the bottom.
 - Trousers, leggings, shorts, skirts: waistband at the top.
 - Shoes and boots: the right way up (sole at the bottom), never upside down. A sole-only shot is fine in any direction.
 - Labels and tags: rotate so the text reads horizontally, left to right.
 - Detail shots where the direction is genuinely unclear (a patch of fabric): leave at 0.
 rotateClockwiseDegrees is 0, 90, 180 or 270: the clockwise rotation needed to correct the photo as it is currently shown. Rotation only: never mirror, flip or crop. If you are not confident, return 0 with rotationConfidence "low" and flag "rotation_uncertain".

confidence: low/medium/high per field. flags: short codes for anything a human must check.`

const num = (v: unknown) => (v == null || v === '' ? null : Number(v));

export type AnalyseInput = { notes?: string; hints?: string; descriptionOnly?: { title: string; description: string; conditionId: number | null }; recentOpeners?: string[] };

export async function analysePhotos(images: { base64: string }[], input: AnalyseInput = {}): Promise<Analysis> {
  const { data, error } = await supabase.functions.invoke('vinted-analyse', {
    body: {
      images: images.map((i) => i.base64),
      schema: analysisSchema(),
      rules: ANALYSIS_RULES,
      reference: aiReference,
      notes: (input.notes ?? '').slice(0, 1000),
      hints: (input.hints ?? '').slice(0, 300),
      descriptionOnly: input.descriptionOnly,
      recentOpeners: input.recentOpeners?.slice(-10),
    },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return normaliseAnalysis(data.result, images.length);
}

/** Convert raw AI output (string IDs) into typed values. */
export function normaliseAnalysis(r: any, photoCount = Array.isArray(r?.photos) ? r.photos.length : 0): Analysis {
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
  const photos = photoCount ? validatePlan(r.photos, photoCount) : null;
  if (photoCount > 1 && !photos) flags.add('photo_plan_invalid');
  return {
    photos,
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
    confidence: r.confidence ?? {},
    flags: [...flags],
  };
}

/** Turn an AI analysis into a draft payload. Price is optional: only a custom price typed by the human is sent. */
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
