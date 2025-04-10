
import React, { createContext, useContext } from 'react';
import { RewardCategory, PointEntry, DailySummary } from '@/types/reward';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/useCategories';
import { usePointEntries } from '@/hooks/usePointEntries';
import { useDailySummary } from '@/hooks/useDailySummary';
import { useEmailSettings } from '@/hooks/useEmailSettings';
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
  const { 
    contactInfo, 
    setContactInfo, 
    autoSendEnabled, 
    setAutoSendEnabled, 
    autoSendTime, 
    setAutoSendTime,
    savingSettings,
    saveSettingsToDatabase
  } = useEmailSettings();

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
        await sendSummaryEmail(contactInfo.email, summary);
        
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
