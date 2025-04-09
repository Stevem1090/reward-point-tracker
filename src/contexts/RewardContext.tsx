
import React, { createContext, useContext, useState, useEffect } from 'react';
import { RewardCategory, PointEntry, DailySummary } from '@/types/reward';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  autoSendEnabled: boolean;
  setAutoSendEnabled: (enabled: boolean) => void;
  autoSendTime: string;
  setAutoSendTime: (time: string) => void;
  isLoading: boolean;
}

const RewardContext = createContext<RewardContextType | undefined>(undefined);

export const RewardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<RewardCategory[]>([]);
  const [entries, setEntries] = useState<PointEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [contactInfo, setContactInfo] = useState<{ email: string; whatsapp: string }>(() => {
    const saved = localStorage.getItem('contactInfo');
    return saved ? JSON.parse(saved) : { email: '', whatsapp: '' };
  });

  const [autoSendEnabled, setAutoSendEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoSendEnabled');
    return saved ? JSON.parse(saved) : false;
  });

  const [autoSendTime, setAutoSendTime] = useState<string>(() => {
    const saved = localStorage.getItem('autoSendTime');
    return saved ? JSON.parse(saved) : '19:00'; // Default to 7:00 PM
  });
  
  const { toast } = useToast();

  // Fetch categories from Supabase
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('reward_categories')
          .select('*');
        
        if (error) {
          throw error;
        }
        
        if (data) {
          const mappedCategories: RewardCategory[] = data.map(cat => ({
            id: cat.id,
            name: cat.name,
            pointValue: cat.point_value,
            description: cat.description || ''
          }));
          setCategories(mappedCategories);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast({
          title: "Error",
          description: "Failed to load categories",
          variant: "destructive",
        });
      }
    };
    
    fetchCategories();
    
    // Subscribe to realtime updates on categories
    const categorySubscription = supabase
      .channel('public:reward_categories')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reward_categories'
      }, () => {
        fetchCategories();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(categorySubscription);
    };
  }, [toast]);

  // Fetch entries from Supabase
  useEffect(() => {
    const fetchEntries = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('point_entries')
          .select('*')
          .order('timestamp', { ascending: false });
        
        if (error) {
          throw error;
        }
        
        if (data) {
          const mappedEntries: PointEntry[] = data.map(entry => ({
            id: entry.id,
            categoryId: entry.category_id,
            description: entry.description || '',
            points: entry.points,
            timestamp: new Date(entry.timestamp)
          }));
          setEntries(mappedEntries);
        }
      } catch (error) {
        console.error('Error fetching entries:', error);
        toast({
          title: "Error",
          description: "Failed to load point entries",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEntries();
    
    // Subscribe to realtime updates on entries
    const entrySubscription = supabase
      .channel('public:point_entries')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'point_entries'
      }, () => {
        fetchEntries();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(entrySubscription);
    };
  }, [toast]);

  useEffect(() => {
    localStorage.setItem('contactInfo', JSON.stringify(contactInfo));
  }, [contactInfo]);

  useEffect(() => {
    localStorage.setItem('autoSendEnabled', JSON.stringify(autoSendEnabled));
  }, [autoSendEnabled]);

  useEffect(() => {
    localStorage.setItem('autoSendTime', JSON.stringify(autoSendTime));
  }, [autoSendTime]);

  useEffect(() => {
    if (!autoSendEnabled || !contactInfo.email) return;

    const checkAndSendSummary = () => {
      const now = new Date();
      const [hours, minutes] = autoSendTime.split(':').map(Number);
      
      if (now.getHours() === hours && now.getMinutes() === minutes) {
        // Check if we have already sent today's summary
        const lastSentDate = localStorage.getItem('lastAutoSentDate');
        const today = now.toDateString();
        
        if (lastSentDate !== today) {
          sendSummary('email');
          localStorage.setItem('lastAutoSentDate', today);
        }
      }
    };

    // Check every minute
    const intervalId = setInterval(checkAndSendSummary, 60000);
    
    // Run once immediately to check if we need to send right now
    checkAndSendSummary();
    
    return () => clearInterval(intervalId);
  }, [autoSendEnabled, autoSendTime, contactInfo.email]);

  const addCategory = async (category: Omit<RewardCategory, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('reward_categories')
        .insert({
          name: category.name,
          point_value: category.pointValue,
          description: category.description
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      if (data) {
        const newCategory: RewardCategory = {
          id: data.id,
          name: data.name,
          pointValue: data.point_value,
          description: data.description || ''
        };
        
        toast({
          title: "Category Added",
          description: `${category.name} has been added as a new category`,
        });
      }
    } catch (error) {
      console.error('Error adding category:', error);
      toast({
        title: "Error",
        description: "Failed to add category",
        variant: "destructive",
      });
    }
  };

  const updateCategory = async (updatedCategory: RewardCategory) => {
    try {
      const { error } = await supabase
        .from('reward_categories')
        .update({
          name: updatedCategory.name,
          point_value: updatedCategory.pointValue,
          description: updatedCategory.description
        })
        .eq('id', updatedCategory.id);
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Category Updated",
        description: `${updatedCategory.name} has been updated`,
      });
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const categoryToDelete = categories.find(cat => cat.id === id);
      if (!categoryToDelete) return;
      
      const { error } = await supabase
        .from('reward_categories')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Category Deleted",
        description: `${categoryToDelete.name} has been removed`,
        variant: "destructive",
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  const addEntry = async (entry: Omit<PointEntry, 'id' | 'timestamp'>) => {
    try {
      const category = categories.find(cat => cat.id === entry.categoryId);
      if (!category) return;
      
      const finalPoints = entry.points || category.pointValue;
      
      const { error } = await supabase
        .from('point_entries')
        .insert({
          category_id: entry.categoryId,
          description: entry.description,
          points: finalPoints
        });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: `${finalPoints >= 0 ? 'Points Earned' : 'Points Lost'}`,
        description: `${Math.abs(finalPoints)} points for ${category.name}`,
        variant: finalPoints >= 0 ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Error adding entry:', error);
      toast({
        title: "Error",
        description: "Failed to add point entry",
        variant: "destructive",
      });
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('point_entries')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: "Error",
        description: "Failed to delete entry",
        variant: "destructive",
      });
    }
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
      setContactInfo,
      autoSendEnabled,
      setAutoSendEnabled,
      autoSendTime,
      setAutoSendTime,
      isLoading
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
