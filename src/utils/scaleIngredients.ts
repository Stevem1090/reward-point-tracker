import { Ingredient } from '@/types/meal';

/**
 * Parse a quantity string that may contain fractions or mixed numbers
 * Examples: "1", "1.5", "1/2", "1 1/2", "2½"
 */
function parseQuantity(quantity: string): number | null {
  if (!quantity || quantity.trim() === '') return null;
  
  const cleaned = quantity.trim().toLowerCase();
  
  // Handle special cases
  if (['to taste', 'pinch', 'handful', 'some', 'as needed'].some(s => cleaned.includes(s))) {
    return null;
  }
  
  // Replace unicode fractions
  const unicodeFractions: Record<string, number> = {
    '½': 0.5,
    '⅓': 1/3,
    '⅔': 2/3,
    '¼': 0.25,
    '¾': 0.75,
    '⅕': 0.2,
    '⅖': 0.4,
    '⅗': 0.6,
    '⅘': 0.8,
    '⅙': 1/6,
    '⅚': 5/6,
    '⅛': 0.125,
    '⅜': 0.375,
    '⅝': 0.625,
    '⅞': 0.875,
  };
  
  // Check for mixed number with unicode fraction (e.g., "1½")
  for (const [frac, value] of Object.entries(unicodeFractions)) {
    if (cleaned.includes(frac)) {
      const whole = cleaned.replace(frac, '').trim();
      const wholeNum = whole ? parseFloat(whole) : 0;
      if (!isNaN(wholeNum)) {
        return wholeNum + value;
      }
    }
  }
  
  // Handle text fractions (e.g., "1/2", "1 1/2")
  const fractionMatch = cleaned.match(/^(\d+)?\s*(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const whole = fractionMatch[1] ? parseFloat(fractionMatch[1]) : 0;
    const numerator = parseFloat(fractionMatch[2]);
    const denominator = parseFloat(fractionMatch[3]);
    if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
      return whole + (numerator / denominator);
    }
  }
  
  // Handle range (take the higher value, e.g., "2-3" -> 3)
  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    return parseFloat(rangeMatch[2]);
  }
  
  // Simple number
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Format a scaled quantity for display
 * Keeps up to 2 decimal places, removes trailing zeros
 */
function formatQuantity(value: number): string {
  // Round to 2 decimal places
  const rounded = Math.round(value * 100) / 100;
  
  // Convert to string and remove trailing zeros
  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }
  
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Scale ingredients from base servings to target servings
 * Preserves non-numeric quantities (e.g., "to taste", "pinch")
 */
export function scaleIngredients(
  ingredients: Ingredient[],
  baseServings: number,
  targetServings: number
): Ingredient[] {
  if (baseServings === targetServings || baseServings <= 0) {
    return ingredients;
  }
  
  const scaleFactor = targetServings / baseServings;
  
  return ingredients.map(ing => {
    const parsedQty = parseQuantity(ing.quantity);
    
    // If we couldn't parse it, return unchanged
    if (parsedQty === null) {
      return ing;
    }
    
    const scaledQty = parsedQty * scaleFactor;
    
    return {
      ...ing,
      quantity: formatQuantity(scaledQty)
    };
  });
}

/**
 * Format an ingredient for display (quantity + unit + name)
 */
export function formatIngredient(ingredient: Ingredient): string {
  const parts: string[] = [];
  
  if (ingredient.quantity && ingredient.quantity.trim()) {
    parts.push(ingredient.quantity.trim());
  }
  
  if (ingredient.unit && ingredient.unit.trim()) {
    parts.push(ingredient.unit.trim());
  }
  
  if (ingredient.name && ingredient.name.trim()) {
    parts.push(ingredient.name.trim());
  }
  
  return parts.join(' ');
}
