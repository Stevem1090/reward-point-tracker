
import React, { createContext, useContext } from 'react';
import { RewardCategory, PointEntry, DailySummary } from '@/types/reward';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/useCategories';
import { usePointEntries } from '@/hooks/usePointEntries';
import { useDailySummary } from '@/hooks/useDailySummary';
import { sendSummaryEmail } from '@/utils/summaryUtils';

interface RewardContextType {
  categories: RewardCategory[];
  entries: PointEntry[];
  addCategory: (category: Omit<RewardCategory, 'id'>) => void;
  updateCategory: (category: RewardCategory) => void;
  deleteCategory: (id: string) => void;
  addEntry: (entry: Omit<PointEntry, 'id' | 'timestamp'>) => void;
  deleteEntry: (id: string) => void;
  getDailySummary: (date?: Date) => DailySummary;
  sendSummary: (method: 'email') => void;
  isLoading: boolean;
  selectedDate: Date;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;
  fetchEntriesForDate: (date: Date) => void;
}

const RewardContext = createContext<RewardContextType | undefined>(undefined);

export const RewardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();
  const { 
    entries, 
    isLoading, 
    selectedDate, 
    goToPreviousDay, 
    goToNextDay, 
    goToToday, 
    fetchEntriesForDate, 
    addEntry, 
    deleteEntry 
  } = usePointEntries(categories);
  const { getDailySummary } = useDailySummary(entries, categories, selectedDate);

  const sendSummary = async (method: 'email') => {
    const summary = getDailySummary();
    
    if (summary.entriesByCategory.length === 0) {
      toast({
        title: "No entries today",
        description: "There are no point entries for today to send.",
        variant: "destructive",
      });
      return;
    }
    
    // This function still exists but will not be accessible from the UI
    if (method === 'email') {
      toast({
        title: "Email Functionality Removed",
        description: "Email functionality has been removed from the application.",
        variant: "destructive",
      });
    }
  };

  return (
    <RewardContext.Provider value={{
      categories,
      entries,
      addCategory,
      updateCategory,
      deleteCategory,
      addEntry,
      deleteEntry,
      getDailySummary,
      sendSummary,
      isLoading,
      selectedDate,
      goToPreviousDay,
      goToNextDay,
      goToToday,
      fetchEntriesForDate
    }}>
      {children}
    </RewardContext.Provider>
  );
};

export const useReward = () => {
  const context = useContext(RewardContext);
  if (context === undefined) {
    throw new Error('useReward must be used within a RewardProvider');
  }
  return context;
};
