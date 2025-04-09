
export interface RewardCategory {
  id: string;
  name: string;
  pointValue: number;
  description: string;
}

export interface PointEntry {
  id: string;
  categoryId: string;
  description: string;
  points: number;
  timestamp: Date;
}

export interface DailySummary {
  date: string;
  totalPoints: number;
  entriesByCategory: {
    categoryId: string;
    categoryName: string;
    totalPoints: number;
    entries: PointEntry[];
  }[];
}
