
import React, { createContext, useContext, useState, useEffect } from 'react';
import { RewardCategory, PointEntry, DailySummary } from '@/types/reward';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';

interface RewardContextType {
  categories: RewardCategory[];
  entries: PointEntry[];
  addCategory: (category: Omit<RewardCategory, 'id'>) => void;
  updateCategory: (category: RewardCategory) => void;
  deleteCategory: (id: string) => void;
  addEntry: (entry: Omit<PointEntry, 'id' | 'timestamp'>) => void;
  deleteEntry: (id: string) => void;
  getDailySummary: () => DailySummary;
  sendSummary: (method: 'email' | 'whatsapp') => void;
  contactInfo: { email: string; whatsapp: string };
  setContactInfo: (info: { email: string; whatsapp: string }) => void;
}

const defaultCategories: RewardCategory[] = [
  { id: uuidv4(), name: 'Completing Homework', pointValue: 10, description: 'Finishing all homework assignments' },
  { id: uuidv4(), name: 'Cleaning Room', pointValue: 5, description: 'Keeping the bedroom tidy' },
  { id: uuidv4(), name: 'Good Behavior', pointValue: 3, description: 'Being polite and following instructions' },
  { id: uuidv4(), name: 'Reading', pointValue: 5, description: 'Reading for at least 30 minutes' },
];

const RewardContext = createContext<RewardContextType | undefined>(undefined);

export const RewardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<RewardCategory[]>(() => {
    const saved = localStorage.getItem('rewardCategories');
    return saved ? JSON.parse(saved) : defaultCategories;
  });
  
  const [entries, setEntries] = useState<PointEntry[]>(() => {
    const saved = localStorage.getItem('pointEntries');
    if (saved) {
      const parsedEntries = JSON.parse(saved);
      return parsedEntries.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      }));
    }
    return [];
  });

  const [contactInfo, setContactInfo] = useState<{ email: string; whatsapp: string }>(() => {
    const saved = localStorage.getItem('contactInfo');
    return saved ? JSON.parse(saved) : { email: '', whatsapp: '' };
  });
  
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem('rewardCategories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('pointEntries', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem('contactInfo', JSON.stringify(contactInfo));
  }, [contactInfo]);

  const addCategory = (category: Omit<RewardCategory, 'id'>) => {
    const newCategory = { ...category, id: uuidv4() };
    setCategories([...categories, newCategory]);
    toast({
      title: "Category Added",
      description: `${category.name} has been added as a new category`,
    });
  };

  const updateCategory = (updatedCategory: RewardCategory) => {
    setCategories(categories.map(cat => 
      cat.id === updatedCategory.id ? updatedCategory : cat
    ));
    toast({
      title: "Category Updated",
      description: `${updatedCategory.name} has been updated`,
    });
  };

  const deleteCategory = (id: string) => {
    const categoryToDelete = categories.find(cat => cat.id === id);
    if (categoryToDelete) {
      setCategories(categories.filter(cat => cat.id !== id));
      toast({
        title: "Category Deleted",
        description: `${categoryToDelete.name} has been removed`,
        variant: "destructive",
      });
    }
  };

  const addEntry = (entry: Omit<PointEntry, 'id' | 'timestamp'>) => {
    const category = categories.find(cat => cat.id === entry.categoryId);
    if (!category) return;
    
    const newEntry = { 
      ...entry, 
      id: uuidv4(), 
      timestamp: new Date(),
      points: entry.points || category.pointValue 
    };
    
    setEntries([...entries, newEntry]);
    
    toast({
      title: `${entry.points >= 0 ? 'Points Earned' : 'Points Lost'}`,
      description: `${Math.abs(entry.points || category.pointValue)} points for ${category.name}`,
      variant: entry.points >= 0 ? "default" : "destructive",
    });
  };

  const deleteEntry = (id: string) => {
    setEntries(entries.filter(entry => entry.id !== id));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const getDailySummary = (): DailySummary => {
    const todayEntries = entries.filter(entry => isToday(new Date(entry.timestamp)));
    
    const totalPoints = todayEntries.reduce((sum, entry) => sum + entry.points, 0);
    
    const entriesByCategory = categories.map(category => {
      const categoryEntries = todayEntries.filter(entry => entry.categoryId === category.id);
      return {
        categoryId: category.id,
        categoryName: category.name,
        totalPoints: categoryEntries.reduce((sum, entry) => sum + entry.points, 0),
        entries: categoryEntries
      };
    }).filter(cat => cat.entries.length > 0);
    
    return {
      date: new Date().toLocaleDateString(),
      totalPoints,
      entriesByCategory
    };
  };

  const sendSummary = (method: 'email' | 'whatsapp') => {
    const summary = getDailySummary();
    
    if (summary.entriesByCategory.length === 0) {
      toast({
        title: "No entries today",
        description: "There are no point entries for today to send.",
        variant: "destructive",
      });
      return;
    }
    
    let summaryText = `Daily Point Summary for ${summary.date}\n\n`;
    summaryText += `Total Points: ${summary.totalPoints}\n\n`;
    
    summary.entriesByCategory.forEach(category => {
      summaryText += `${category.categoryName}: ${category.totalPoints} points\n`;
      category.entries.forEach(entry => {
        summaryText += `- ${entry.description || category.categoryName}: ${entry.points} points\n`;
      });
      summaryText += '\n';
    });
    
    if (method === 'email') {
      if (!contactInfo.email) {
        toast({
          title: "No email address",
          description: "Please set your email address in the settings.",
          variant: "destructive",
        });
        return;
      }
      
      // In a real app, this would call an API to send an email
      console.log(`Sending email to ${contactInfo.email}:\n${summaryText}`);
      toast({
        title: "Summary Sent",
        description: `Daily point summary has been sent to ${contactInfo.email}`,
      });
    } else if (method === 'whatsapp') {
      if (!contactInfo.whatsapp) {
        toast({
          title: "No WhatsApp number",
          description: "Please set your WhatsApp number in the settings.",
          variant: "destructive",
        });
        return;
      }
      
      // In a real app, this would open WhatsApp with the summary
      const encodedText = encodeURIComponent(summaryText);
      window.open(`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, '')}?text=${encodedText}`, '_blank');
      
      toast({
        title: "WhatsApp Opened",
        description: "Daily point summary has been prepared for WhatsApp",
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
      contactInfo,
      setContactInfo
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
