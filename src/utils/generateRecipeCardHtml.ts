import { recipeCardTemplate } from '@/templates/recipeCardTemplate';
import { Ingredient } from '@/types/meal';
import { scaleIngredients, formatIngredient } from './scaleIngredients';

export interface RecipeCardData {
  title: string;
  servings: number;
  cookMinutes: number | null;
  imageUrl?: string | null;
  ingredients: Ingredient[];
  steps: string[];
  sourceUrl?: string | null;
  dayOfWeek?: string;
  baseServings?: number;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = typeof document !== 'undefined' 
    ? document.createElement('div') 
    : null;
  
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Fallback for SSR/Edge functions
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate the HTML content for a recipe card
 */
export function generateRecipeCardHtml(data: RecipeCardData): string {
  // Build meta line: "Serves 4 | 30 mins"
  const metaParts: string[] = [];
  metaParts.push(`Serves ${data.servings}`);
  if (data.cookMinutes) {
    metaParts.push(`${data.cookMinutes} mins`);
  }
  const meta = metaParts.join(' | ');

  // Build image block
  const imageBlock = data.imageUrl
    ? `<img src="${escapeHtml(data.imageUrl)}" alt="Recipe image" />`
    : `<div class="placeholder">Recipe Image</div>`;

  // Scale ingredients if needed
  const scaledIngredients = data.baseServings && data.baseServings !== data.servings
    ? scaleIngredients(data.ingredients, data.baseServings, data.servings)
    : data.ingredients;

  // Build ingredients HTML as <ul>
  const ingredientsHtml = scaledIngredients.length > 0
    ? `<ul>${scaledIngredients
        .map(ing => `<li>${escapeHtml(formatIngredient(ing))}</li>`)
        .join('')}</ul>`
    : '<p>No ingredients listed</p>';

  // Build steps HTML dynamically - only render steps that exist
  const stepsHtml = data.steps.length > 0
    ? data.steps
        .map((step, index) => 
          `<div class="step-row">
            <div class="step-num">${index + 1}</div>
            <p class="step-text">${escapeHtml(step)}</p>
          </div>`
        )
        .join('')
    : '<p class="no-steps">No steps listed</p>';

  // Footer
  const footerLeft = data.dayOfWeek || '';
  const footerRight = data.sourceUrl || '';

  // Replace placeholders
  return recipeCardTemplate
    .replace(/\{\{title\}\}/g, escapeHtml(data.title))
    .replace(/\{\{meta\}\}/g, escapeHtml(meta))
    .replace(/\{\{image_block\}\}/g, imageBlock)
    .replace(/\{\{ingredients_html\}\}/g, ingredientsHtml)
    .replace(/\{\{steps_html\}\}/g, stepsHtml)
    .replace(/\{\{footer_left\}\}/g, escapeHtml(footerLeft))
    .replace(/\{\{footer_right\}\}/g, escapeHtml(footerRight));
}
