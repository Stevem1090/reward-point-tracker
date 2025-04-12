
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, subDays } from 'date-fns';
import { PointEntry } from '@/types/reward';
import { fetchEntriesForDate, addEntry, deleteEntry } from '@/utils/pointEntryUtils';
import { supabase } from '@/integrations/supabase/client';

export const usePointEntries = (categories: any[]) => {
  const [entries, setEntries] = useState<PointEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();

  const fetchEntries = async (date: Date) => {
    try {
      setIsLoading(true);
      const data = await fetchEntriesForDate(date);
      setEntries(data);
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
    fetchEntries(selectedDate);
    
    const entrySubscription = supabase
      .channel('public:point_entries')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'point_entries'
      }, () => {
        fetchEntries(selectedDate);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(entrySubscription);
    };
  }, [selectedDate]);

  const goToPreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const goToNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleAddEntry = async (entry: Omit<PointEntry, 'id' | 'timestamp'>, entryDate?: Date) => {
    try {
      const category = categories.find(cat => cat.id === entry.categoryId);
      if (!category) return;
      
      // Use the provided date or default to the current date
      const timestamp = entryDate || new Date();
      
      await addEntry({ ...entry, customDate: timestamp }, categories);
      
      toast({
        title: `${entry.points >= 0 ? 'Points Earned' : 'Points Lost'}`,
        description: `${Math.abs(entry.points)} points for ${category.name}`,
        variant: entry.points >= 0 ? "default" : "destructive",
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

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteEntry(id);
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: "Error",
        description: "Failed to delete entry",
        variant: "destructive",
      });
    }
  };

  return {
    entries,
    isLoading,
    selectedDate,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    fetchEntriesForDate: fetchEntries,
    addEntry: handleAddEntry,
    deleteEntry: handleDeleteEntry
  };
};
