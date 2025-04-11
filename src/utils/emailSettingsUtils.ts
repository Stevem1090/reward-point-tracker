
import { supabase } from '@/integrations/supabase/client';
import { EmailSettings } from '@/types/emailSettings';

export const saveEmailSettingsToDatabase = async (
  email: string, 
  isAutoSend: boolean, 
  timeValue: string = '19:00'
): Promise<void> => {
  // First delete any existing settings for this email to avoid duplicates
  const { error: deleteError } = await supabase
    .from('auto_email_settings')
    .delete()
    .eq('email', email);
  
  if (deleteError) {
    console.error('Error cleaning up duplicate settings:', deleteError);
  }
  
  // Insert the new settings - always use 19:00 (7:00 PM) as the default time
  const { error: insertError } = await supabase
    .from('auto_email_settings')
    .insert({
      email: email,
      auto_send_enabled: isAutoSend,
      auto_send_time: '19:00:00' // Fixed time: 7:00 PM UTC
    });
      
  if (insertError) {
    throw insertError;
  }
  
  console.log(`Email settings saved to database: ${email}, auto-send: ${isAutoSend}, time: 19:00:00`);
};

export const loadEmailSettings = async (email: string): Promise<EmailSettings | null> => {
  if (!email) return null;
  
  const { data: allSettings, error: fetchAllError } = await supabase
    .from('auto_email_settings')
    .select('*')
    .eq('email', email);
  
  if (fetchAllError) {
    throw fetchAllError;
  }
  
  if (allSettings && allSettings.length > 1) {
    console.log(`Found ${allSettings.length} settings for ${email}, cleaning up...`);
    
    const sortedSettings = [...allSettings].sort((a, b) => 
      a.id.localeCompare(b.id)
    );
    
    const mostRecent = sortedSettings[sortedSettings.length - 1];
    
    // Clean up duplicate settings
    for (const setting of sortedSettings) {
      if (setting.id !== mostRecent.id) {
        await supabase
          .from('auto_email_settings')
          .delete()
          .eq('id', setting.id);
      }
    }
    
    console.log(`Loaded email settings from database for ${email}`);
    return mostRecent as unknown as EmailSettings;
  } 
  else if (allSettings && allSettings.length === 1) {
    console.log(`Loaded email settings from database for ${email}`);
    return allSettings[0] as unknown as EmailSettings;
  }
  
  return null;
};
