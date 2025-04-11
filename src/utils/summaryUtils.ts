
import { supabase } from '@/integrations/supabase/client';
import { DailySummary, PointEntry } from '@/types/reward';
import { startOfWeek, endOfWeek } from 'date-fns';

export const isDateMatching = (entryDate: Date, targetDate: Date): boolean => {
  return entryDate.getDate() === targetDate.getDate() &&
    entryDate.getMonth() === targetDate.getMonth() &&
    entryDate.getFullYear() === targetDate.getFullYear();
};

export const sendSummaryEmail = async (
  email: string,
  summary: DailySummary
): Promise<void> => {
  if (summary.entriesByCategory.length === 0) {
    throw new Error("No entries to send");
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
  
  console.log(`Preparing to send email to ${email}`);
  
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      email: email,
      subject: `Daily Points Summary for ${summary.date}`,
      content: summaryHTML
    },
  });
  
  if (error) {
    console.error('Error sending email:', error);
    throw error;
  }
  
  console.log('Email send response:', data);
};

export const getWeeklyPoints = async (currentDate: Date): Promise<number> => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday as start of week
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday as end of week
  
  // Format to ISO string for database query
  const startTime = weekStart.toISOString();
  const endTime = weekEnd.toISOString();
  
  try {
    const { data, error } = await supabase
      .from('point_entries')
      .select('points')
      .gte('timestamp', startTime)
      .lte('timestamp', endTime);
    
    if (error) {
      console.error('Error fetching weekly points:', error);
      throw error;
    }
    
    // Calculate total points
    return data?.reduce((total, entry) => total + entry.points, 0) || 0;
  } catch (error) {
    console.error('Error in getWeeklyPoints:', error);
    return 0;
  }
};
