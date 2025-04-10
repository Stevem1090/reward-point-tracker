
import { supabase } from '@/integrations/supabase/client';
import { PointEntry, RewardCategory } from '@/types/reward';
import { startOfDay, endOfDay } from 'date-fns';

export const addEntry = async (
  entry: Omit<PointEntry, 'id' | 'timestamp'>, 
  categories: RewardCategory[]
): Promise<void> => {
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
};

export const deleteEntry = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('point_entries')
    .delete()
    .eq('id', id);
  
  if (error) {
    throw error;
  }
};

export const fetchEntriesForDate = async (date: Date): Promise<PointEntry[]> => {
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
    return data.map(entry => ({
      id: entry.id,
      categoryId: entry.category_id,
      description: entry.description || '',
      points: entry.points,
      timestamp: new Date(entry.timestamp)
    }));
  }
  
  return [];
};
