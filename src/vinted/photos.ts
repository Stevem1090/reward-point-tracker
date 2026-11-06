/** Photo order and orientation: AI plan validation and the item's final photo arrangement. Pure, no DOM. */

export type PhotoRole = 'full_flat_lay' | 'full_other' | 'detail' | 'flaw' | 'label' | 'other';
export type Degrees = 0 | 90 | 180 | 270;
export type PhotoPlanEntry = {
  /** 1-based number the photo had in the request (= the order the seller added them). */
  photoId: number;
  role: PhotoRole;
  rotateClockwiseDegrees: Degrees;
  rotationConfidence: 'low' | 'medium' | 'high';
  note: string;
};

/** One photo in the final order. src is the 0-based index into item.images (the originals). */
export type ArrangedPhoto = {
  src: number;
  rotate: Degrees;
  role?: PhotoRole;
  /** Degrees the app applied automatically from the AI plan (cleared when the seller rotates by hand). */
  autoDeg?: Degrees;
  /** AI was unsure of rotation, so it was left alone. */
  checkRotation?: boolean;
};

export const PHOTO_FLAGS = ['no_full_item_photo', 'person_visible', 'possible_duplicate_photo', 'photo_quality', 'rotation_uncertain', 'photo_plan_invalid'];
export const ROLE_LABEL: Record<PhotoRole, string> = {
  full_flat_lay: 'Full item', full_other: 'Full item', detail: 'Detail', flaw: 'Flaw', label: 'Label', other: 'Other',
};
const ROLES = Object.keys(ROLE_LABEL);
const DEGREES = [0, 90, 180, 270];

/** Valid only if every photo 1..count appears exactly once with valid degrees. Otherwise null. */
export function validatePlan(raw: unknown, count: number): PhotoPlanEntry[] | null {
  if (!Array.isArray(raw) || raw.length !== count) return null;
  const seen = new Set<number>();
  const out: PhotoPlanEntry[] = [];
  for (const r of raw as any[]) {
    const id = Number(r?.photoId);
    const deg = Number(r?.rotateClockwiseDegrees);
    if (!Number.isInteger(id) || id < 1 || id > count || seen.has(id)) return null;
    if (!DEGREES.includes(deg)) return null;
    seen.add(id);
    out.push({
      photoId: id,
      role: ROLES.includes(r.role) ? r.role : 'other',
      rotateClockwiseDegrees: deg as Degrees,
      rotationConfidence: r.rotationConfidence === 'high' || r.rotationConfidence === 'medium' ? r.rotationConfidence : 'low',
      note: String(r.note ?? '').split(/\s+/).filter(Boolean).slice(0, 12).join(' '),
    });
  }
  return out;
}

export const originalArrangement = (count: number): ArrangedPhoto[] =>
  Array.from({ length: count }, (_, i) => ({ src: i, rotate: 0 as Degrees }));

/**
 * Apply an AI plan to the photos being kept. Rotation is applied only at medium/high confidence;
 * low confidence leaves the photo as it is and marks it "Check rotation".
 */
export function arrangeFromPlan(plan: PhotoPlanEntry[] | null, kept: number[]): ArrangedPhoto[] {
  if (!plan) return kept.map((src) => ({ src, rotate: 0 }));
  const keep = new Set(kept);
  return plan.filter((p) => keep.has(p.photoId - 1)).map((p) => {
    const sure = p.rotationConfidence !== 'low';
    const rotate = sure ? p.rotateClockwiseDegrees : 0;
    return { src: p.photoId - 1, rotate, role: p.role, autoDeg: rotate ? rotate : undefined, checkRotation: !sure || undefined };
  });
}

export const rotateBy = (p: ArrangedPhoto, delta: 90 | -90): ArrangedPhoto =>
  ({ ...p, rotate: (((p.rotate + delta) % 360 + 360) % 360) as Degrees, autoDeg: undefined, checkRotation: undefined });

export function movePhoto<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}
