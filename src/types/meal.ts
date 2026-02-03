export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type MealPlanStatus = 'draft' | 'approved';
export type MealStatus = 'pending' | 'approved' | 'rejected';
export type MealSourceType = 'ai_generated' | 'user_library' | 'user_custom';
export type RecipeSourceType = 'website' | 'cookbook';

export interface Ingredient {
  quantity: string;
  unit: string;
  name: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  source_type: RecipeSourceType;
  recipe_url: string | null;
  cookbook_title: string | null;
  image_url: string | null;
  ingredients: Ingredient[];
  steps: string[];
  servings: number;
  estimated_cook_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface MealPlan {
  id: string;
  user_id: string;
  week_start_date: string;
  status: MealPlanStatus;
  created_at: string;
  approved_at: string | null;
}

export interface Meal {
  id: string;
  meal_plan_id: string;
  recipe_id: string | null;
  day_of_week: DayOfWeek;
  meal_name: string;
  description: string | null;
  recipe_url: string | null;
  source_type: MealSourceType;
  servings: number;
  estimated_cook_minutes: number | null;
  status: MealStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
  rejection_reason: string | null;
  recipe_card?: RecipeCard;
}

export interface RecipeCard {
  id: string;
  meal_id: string;
  meal_name: string;
  image_url: string | null;
  ingredients: Ingredient[];
  steps: string[];
  base_servings: number;
  html_content: string | null;
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  checked: boolean;
}

export interface ShoppingList {
  id: string;
  user_id: string;
  meal_plan_id: string;
  items: ShoppingListItem[];
  created_at: string;
  updated_at: string;
}

export interface MealRating {
  id: string;
  meal_id: string;
  user_id: string;
  rating: number;
  notes: string | null;
  created_at: string;
}

// AI Generation types
export interface AISuggestedMeal {
  day_of_week: DayOfWeek;
  meal_name: string;
  description: string;
  suggested_url: string;
  url_confidence: 'high' | 'medium' | 'low';
  estimated_cook_minutes: number;
  servings: number;
  is_spicy: boolean;
  kid_friendly_notes?: string;
}

export interface MealWithRecipeCard extends Meal {
  recipe_card?: RecipeCard;
}

export interface MealPlanWithMeals extends MealPlan {
  meals: MealWithRecipeCard[];
}

// Shopping list categories
export const SHOPPING_CATEGORIES = [
  'Meat and Fish',
  'Vegetables',
  'Fruit',
  'Dairy and Eggs',
  'Bakery',
  'Pantry and Dry Goods',
  'Frozen',
  'Herbs and Spices',
  'Sauces and Condiments',
  'Other'
] as const;

export type ShoppingCategory = typeof SHOPPING_CATEGORIES[number];

// Days of week in order
export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

// Rejection reason options for meal planning
export const REJECTION_REASONS = [
  { code: 'had_recently', label: 'Had it recently' },
  { code: 'dont_fancy', label: "Don't fancy it" },
  { code: 'too_complex', label: 'Too complex' },
  { code: 'hard_to_find', label: 'Ingredients hard to find' },
  { code: 'not_kid_friendly', label: 'Not kid-friendly' },
  { code: 'other', label: 'Other reason' },
] as const;

export type RejectionReasonCode = typeof REJECTION_REASONS[number]['code'];
export type RejectionReason = RejectionReasonCode | null;

export interface RejectedMeal {
  name: string;
  reason: string;
}
