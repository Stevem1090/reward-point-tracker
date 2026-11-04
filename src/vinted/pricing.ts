import { VINTED_REFERENCE as ref, findLeaf } from './reference';

/** A default price. categoryType/brandId null = "any". Both null = fallback. */
export type PricingRule = { id: string; categoryType: string | null; brandId: number | null; price: number };

const KEY = 'vinted-pricing-rules-v1';
export const PRICE_STEP = 1; // AI may move a rule price by at most one £1 step for condition

export const DEFAULT_RULES: PricingRule[] = [
  { id: 'fallback', categoryType: null, brandId: null, price: 3 },
];

/** "Kids > Girls clothing > Jumpers & hoodies > …" -> "Jumpers & hoodies" (gender ignored). */
export function categoryType(leafId: number | string | null | undefined): string | null {
  if (leafId == null) return null;
  const leaf = findLeaf(leafId);
  if (!leaf) return null;
  return leaf.group.split(' > ')[2] ?? 'Other clothing';
}

export const CATEGORY_TYPES: string[] = [...new Set(
  (ref.categories as { group: string }[]).map((g) => g.group.split(' > ')[2] ?? 'Other clothing'),
)].sort();

export function loadRules(): PricingRule[] {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(r) && r.length) return r;
  } catch { /* ignore */ }
  return DEFAULT_RULES;
}
export const saveRules = (rules: PricingRule[]) => localStorage.setItem(KEY, JSON.stringify(rules));

/** Most specific match wins: category+brand, then category, then brand, then fallback. */
export function matchRule(rules: PricingRule[], leafId: number | null | undefined, brandId: number | null | undefined): PricingRule | null {
  const type = categoryType(leafId);
  const score = (r: PricingRule) => {
    if (r.categoryType && r.categoryType !== type) return -1;
    if (r.brandId != null && r.brandId !== brandId) return -1;
    return (r.categoryType ? 2 : 0) + (r.brandId != null ? 1 : 0);
  };
  let best: PricingRule | null = null, bestScore = -1;
  for (const r of rules) { const s = score(r); if (s > bestScore) { best = r; bestScore = s; } }
  return best;
}

/** Whole pounds or 50p steps, minimum 50p. */
export const roundPrice = (p: number) => Math.max(0.5, Math.round(p * 2) / 2);

export const ruleLabel = (r: PricingRule) => {
  const brand = r.brandId != null ? (ref.brands.main as Record<string, string>)[String(r.brandId)] : null;
  if (!r.categoryType && !brand) return 'Fallback';
  return [r.categoryType, brand].filter(Boolean).join(', ');
};

export const rulesForAI = (rules: PricingRule[]) =>
  rules.map((r) => `- ${ruleLabel(r)}: £${r.price.toFixed(2)}`).join('\n');

/**
 * Apply the pricing rules to the AI's suggestion: with a matching specific rule, stay within one
 * step of it; with only the fallback, keep the AI's figure but mark low confidence.
 */
export function applyPricing(rules: PricingRule[], leafId: number | null, brandId: number | null, ai: { suggestedPrice: number | null; priceRationale: string; priceConfidence: 'low' | 'medium' | 'high' }) {
  const rule = matchRule(rules, leafId, brandId);
  const specific = rule && (rule.categoryType || rule.brandId != null);
  if (specific) {
    const raw = ai.suggestedPrice ?? rule.price;
    const p = roundPrice(Math.min(rule.price + PRICE_STEP, Math.max(rule.price - PRICE_STEP, raw)));
    const why = p === rule.price ? '' : ` Adjusted ${p > rule.price ? 'up' : 'down'} for condition.`;
    return { suggestedPrice: p, priceRationale: `Pricing rule "${ruleLabel(rule)}" (£${rule.price.toFixed(2)}).${why}`, priceConfidence: ai.priceConfidence === 'low' ? 'medium' as const : ai.priceConfidence, rule };
  }
  const p = roundPrice(ai.suggestedPrice ?? rule?.price ?? 3);
  return { suggestedPrice: p, priceRationale: ai.priceRationale || `No pricing rule matched.`, priceConfidence: 'low' as const, rule };
}
