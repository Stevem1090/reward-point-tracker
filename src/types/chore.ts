export type ChoreFrequency = 'weekly' | 'monthly' | 'adhoc';

export interface ChoreCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Chore {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  frequency: ChoreFrequency;
  completed_at: string | null;
  archived: boolean;
  created_at: string;
}

export interface ChoreCompletion {
  id: string;
  chore_id: string;
  user_id: string;
  completed_at: string;
}

export interface ChoreWithCompletions extends Chore {
  completions: ChoreCompletion[];
}

export interface CategoryWithChores {
  category: ChoreCategory;
  chores: ChoreWithCompletions[];
  /** Number of distinct non-adhoc chores completed at least once this week */
  completedThisWeek: number;
  /** Total non-adhoc chores in this category */
  totalRepeating: number;
}
