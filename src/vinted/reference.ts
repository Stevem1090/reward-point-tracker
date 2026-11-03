import ref from './vinted-reference-kids.json';

/** Reference data captured from vinted.co.uk/items/new. Never hardcode IDs elsewhere. */
export const VINTED_REFERENCE = ref;
export const REFERENCE_CAPTURED = '3 November 2026';
export const REFERENCE_CAPTURED_ISO = '2026-11-03';

type Group = { group: string; pick: number[]; leaves: Record<string, string> };
const groups = ref.categories as Group[];

export function findLeaf(leafId: string | number) {
  const id = String(leafId);
  const g = groups.find((x) => id in x.leaves);
  return g ? { id: Number(id), name: g.leaves[id], group: g.group, pick: g.pick } : null;
}

export function sizeGroupForLeaf(leafId: string | number): string | null {
  const id = String(leafId);
  const ex = ref.leafSizeGroupExceptions as unknown as Record<string, string[] | string>;
  if ((ex.noSizeField as string[]).includes(id)) return null;
  for (const [k, v] of Object.entries(ex)) {
    if (k === 'noSizeField' || k === 'default') continue;
    if (Array.isArray(v) && v.includes(id)) return k;
  }
  return String(ex.default);
}

export function idByName(options: Record<string, string>, name: string): number {
  const hit = Object.entries(options).find(([, n]) => n.toLowerCase() === name.toLowerCase());
  if (!hit) throw new Error(`"${name}" not found in Vinted reference data`);
  return Number(hit[0]);
}
