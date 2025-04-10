import React, { createContext, useContext, useState, useEffect } from 'react';
import { RewardCategory, PointEntry, DailySummary } from '@/types/reward';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, subDays, startOfDay, endOfDay } from 'date-fns';

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
  contactInfo: { email: string; whatsapp: string };
  setContactInfo: (info: { email: string; whatsapp: string }) => void;
  autoSendEnabled: boolean;
  setAutoSendEnabled: (enabled: boolean) => void;
  autoSendTime: string;
  setAutoSendTime: (time: string) => void;
  isLoading: boolean;
  selectedDate: Date;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;
  fetchEntriesForDate: (date: Date) => void;
  savingSettings: boolean;
  saveSettingsToDatabase: (email: string, autoSendEnabled: boolean, autoSendTime: string) => Promise<void>;
}

interface EmailSettings {
  id: string;
  email: string;
  auto_send_enabled: boolean;
  auto_send_time: string;
  last_sent_date: string | null;
}

const RewardContext = createContext<RewardContextType | undefined>(undefined);

export const RewardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<RewardCategory[]>([]);
  const [entries, setEntries] = useState<PointEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [savingSettings, setSavingSettings] = useState(false);
  
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

  const saveSettingsToDatabase = async (email: string, isAutoSend: boolean, timeValue: string) => {
    try {
      setSavingSettings(true);
      
      const { error: deleteError } = await supabase
        .from('auto_email_settings')
        .delete()
        .eq('email', email);
      
      if (deleteError) {
        console.error('Error cleaning up duplicate settings:', deleteError);
      }
      
      const { error: insertError } = await supabase
        .from('auto_email_settings')
        .insert({
          email: email,
          auto_send_enabled: isAutoSend,
          auto_send_time: timeValue
        });
          
      if (insertError) {
        throw insertError;
      }
      
      console.log(`Email settings saved to database: ${email}, auto-send: ${isAutoSend}, time: ${timeValue}`);
    } catch (error) {
      console.error('Error saving email settings to database:', error);
      toast({
        title: "Error",
        description: "Failed to save email settings to the database",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    const loadEmailSettings = async () => {
      try {
        if (contactInfo.email) {
          const { data: allSettings, error: fetchAllError } = await supabase
            .from('auto_email_settings')
            .select('*')
            .eq('email', contactInfo.email);
          
          if (fetchAllError) {
            throw fetchAllError;
          }
          
          if (allSettings && allSettings.length > 1) {
            console.log(`Found ${allSettings.length} settings for ${contactInfo.email}, cleaning up...`);
            
            const sortedSettings = [...allSettings].sort((a, b) => 
              a.id.localeCompare(b.id)
            );
            
            const mostRecent = sortedSettings[sortedSettings.length - 1];
            
            for (const setting of sortedSettings) {
              if (setting.id !== mostRecent.id) {
                await supabase
                  .from('auto_email_settings')
                  .delete()
                  .eq('id', setting.id);
              }
            }
            
            const settings = mostRecent as unknown as EmailSettings;
            
            setAutoSendEnabled(settings.auto_send_enabled);
            setAutoSendTime(settings.auto_send_time);
            
            localStorage.setItem('autoSendEnabled', JSON.stringify(settings.auto_send_enabled));
            localStorage.setItem('autoSendTime', JSON.stringify(settings.auto_send_time));
            
            console.log(`Loaded email settings from database for ${contactInfo.email}`);
          } 
          else if (allSettings && allSettings.length === 1) {
            const settings = allSettings[0] as unknown as EmailSettings;
            
            setAutoSendEnabled(settings.auto_send_enabled);
            setAutoSendTime(settings.auto_send_time);
            
            localStorage.setItem('autoSendEnabled', JSON.stringify(settings.auto_send_enabled));
            localStorage.setItem('autoSendTime', JSON.stringify(settings.auto_send_time));
            
            console.log(`Loaded email settings from database for ${contactInfo.email}`);
          }
        }
      } catch (error) {
        console.error('Error loading email settings from database:', error);
      }
    };
    
    loadEmailSettings();
  }, [contactInfo.email]);

  useEffect(() => {
    localStorage.setItem('contactInfo', JSON.stringify(contactInfo));
    
    if (contactInfo.email) {
      saveSettingsToDatabase(contactInfo.email, autoSendEnabled, autoSendTime)
        .catch(console.error);
    }
  }, [contactInfo]);

  useEffect(() => {
    localStorage.setItem('autoSendEnabled', JSON.stringify(autoSendEnabled));
    
    if (contactInfo.email) {
      saveSettingsToDatabase(contactInfo.email, autoSendEnabled, autoSendTime)
        .catch(console.error);
    }
  }, [autoSendEnabled]);

  useEffect(() => {
    localStorage.setItem('autoSendTime', JSON.stringify(autoSendTime));
    
    if (contactInfo.email && autoSendEnabled) {
      saveSettingsToDatabase(contactInfo.email, autoSendEnabled, autoSendTime)
        .catch(console.error);
    }
  }, [autoSendTime]);

  const fetchEntriesForDate = async (date: Date) => {
    try {
      setIsLoading(true);
      
      const startTime = startOfDay(date).toISOString();
      const endTime = endOfDay(date).toISOString();
      
      const { data, error } = await supabase
        .from('point_entries')
        .select('*')
        .gte('timestamp', startTime)
        .lte('timestamp', endTime)
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

  useEffect(() => {
    fetchEntriesForDate(selectedDate);
    
    const entrySubscription = supabase
      .channel('public:point_entries')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'point_entries'
      }, () => {
        fetchEntriesForDate(selectedDate);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(entrySubscription);
    };
  }, [selectedDate, toast]);

  const goToPreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const goToNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

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
          points: finalPoints,
          timestamp: new Date().toISOString()
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

  const isDateMatching = (entryDate: Date, targetDate: Date) => {
    return entryDate.getDate() === targetDate.getDate() &&
      entryDate.getMonth() === targetDate.getMonth() &&
      entryDate.getFullYear() === targetDate.getFullYear();
  };

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
    
    let summaryHTML = `<h1>Daily Point Summary for ${summary.date}</h1>`;
    summaryHTML += `<h2>Total Points: ${summary.totalPoints}</h2>`;
    
    summary.entriesByCategory.forEach(category => {
      summaryHTML += `<h3>${category.categoryName}: ${category.totalPoints} points</h3>`;
      summaryHTML += `<ul>`;
      category.entries.forEach(entry => {
        summaryHTML += `<li><strong>${entry.description || category.categoryName}:</strong> ${entry.points} points</li>`;
      });
      summaryHTML += `</ul>`;
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
      
      try {
        console.log(`Preparing to send email to ${contactInfo.email}`);
        
        const { data, error } = await supabase.functions.invoke('send-email', {
          body: {
            email: contactInfo.email,
            subject: `Daily Points Summary for ${summary.date}`,
            content: summaryHTML
          },
        });
        
        if (error) {
          console.error('Error sending email:', error);
          throw error;
        }
        
        console.log('Email send response:', data);
        
        toast({
          title: "Summary Sent",
          description: `Daily point summary has been sent to ${contactInfo.email}`,
        });
      } catch (error) {
        console.error('Error sending email:', error);
        toast({
          title: "Email Sending Failed",
          description: "There was an error sending the email. Please try again later.",
          variant: "destructive",
        });
      }
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
      isLoading,
      selectedDate,
      goToPreviousDay,
      goToNextDay,
      goToToday,
      fetchEntriesForDate,
      savingSettings,
      saveSettingsToDatabase
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
