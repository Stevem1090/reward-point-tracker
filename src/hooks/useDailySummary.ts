
import { PointEntry, RewardCategory, DailySummary } from '@/types/reward';
import { isDateMatching } from '@/utils/summaryUtils';

export const useDailySummary = (
  entries: PointEntry[], 
  categories: RewardCategory[], 
  selectedDate: Date
) => {
  const getDailySummary = (date: Date = selectedDate): DailySummary => {
    const dateEntries = entries.filter(entry => isDateMatching(new Date(entry.timestamp), date));
    
    const totalPoints = dateEntries.reduce((sum, entry) => sum + entry.points, 0);
    
    const entriesByCategory = categories.map(category => {
      const categoryEntries = dateEntries.filter(entry => entry.categoryId === category.id);
      return {
        categoryId: category.id,
        categoryName: category.name,
        totalPoints: categoryEntries.reduce((sum, entry) => sum + entry.points, 0),
        entries: categoryEntries
      };
    }).filter(cat => cat.entries.length > 0);
    
    return {
      date: date.toLocaleDateString(),
      totalPoints,
      entriesByCategory
    };
  };

  return { getDailySummary };
};
