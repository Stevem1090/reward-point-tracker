export type HealthyExtraType = 'calcium' | 'fibre' | 'healthy_fats';

export const HEALTHY_EXTRA_LABELS: Record<HealthyExtraType, string> = {
  calcium: 'Calcium',
  fibre: 'Fibre',
  healthy_fats: 'Healthy Fats',
};

export const HEALTHY_EXTRA_TYPES: HealthyExtraType[] = ['calcium', 'fibre', 'healthy_fats'];

export const SWIPS_DAILY_LIMIT = 15;

export interface SwFood {
  id: string;
  user_id: string;
  name: string;
  weight: string | null;
  swips: number;
  is_free: boolean;
  healthy_extra_type: HealthyExtraType | null;
  healthy_extra_amount: number;
  is_speed: boolean;
  created_at: string;
  updated_at: string;
}

export interface SwMeal {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SwMealItem {
  id: string;
  meal_id: string;
  food_id: string;
  quantity: number;
  food?: SwFood;
}

export interface SwMealWithItems extends SwMeal {
  items: SwMealItem[];
}

export type SwLogEntryType = 'food' | 'meal' | 'recipe';

export interface SwLogEntry {
  id: string;
  user_id: string;
  log_date: string;
  entry_type: SwLogEntryType;
  food_id: string | null;
  meal_id: string | null;
  recipe_id: string | null;
  name_snapshot: string;
  swips_snapshot: number;
  healthy_extra_type_snapshot: HealthyExtraType | null;
  healthy_extra_amount_snapshot: number;
  is_speed_snapshot: boolean;
  quantity: number;
  created_at: string;
}

export interface DailyTotals {
  swips: number;
  healthyExtras: Record<HealthyExtraType, number>;
  speedCount: number;
}
