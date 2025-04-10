
import { supabase } from '@/integrations/supabase/client';
import { DailySummary } from '@/types/reward';

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
