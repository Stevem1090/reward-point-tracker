
import { useState, useEffect } from 'react';
import { saveEmailSettingsToDatabase, loadEmailSettings } from '@/utils/emailSettingsUtils';
import { useToast } from '@/hooks/use-toast';

export const useEmailSettings = () => {
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
  
  const [savingSettings, setSavingSettings] = useState(false);
  const { toast } = useToast();

  // Save email settings to the database
  const saveSettings = async (email: string, isAutoSend: boolean, timeValue: string) => {
    try {
      setSavingSettings(true);
      await saveEmailSettingsToDatabase(email, isAutoSend, timeValue);
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

  // Load email settings from the database
  useEffect(() => {
    const fetchEmailSettings = async () => {
      try {
        if (contactInfo.email) {
          const settings = await loadEmailSettings(contactInfo.email);
          
          if (settings) {
            setAutoSendEnabled(settings.auto_send_enabled);
            setAutoSendTime(settings.auto_send_time);
            
            localStorage.setItem('autoSendEnabled', JSON.stringify(settings.auto_send_enabled));
            localStorage.setItem('autoSendTime', JSON.stringify(settings.auto_send_time));
          }
        }
      } catch (error) {
        console.error('Error loading email settings from database:', error);
      }
    };
    
    fetchEmailSettings();
  }, [contactInfo.email]);

  // Save contact info to localStorage
  useEffect(() => {
    localStorage.setItem('contactInfo', JSON.stringify(contactInfo));
    
    if (contactInfo.email) {
      saveSettings(contactInfo.email, autoSendEnabled, autoSendTime)
        .catch(console.error);
    }
  }, [contactInfo]);

  // Save auto-send enabled state to localStorage
  useEffect(() => {
    localStorage.setItem('autoSendEnabled', JSON.stringify(autoSendEnabled));
    
    if (contactInfo.email) {
      saveSettings(contactInfo.email, autoSendEnabled, autoSendTime)
        .catch(console.error);
    }
  }, [autoSendEnabled]);

  // Save auto-send time to localStorage
  useEffect(() => {
    localStorage.setItem('autoSendTime', JSON.stringify(autoSendTime));
    
    if (contactInfo.email && autoSendEnabled) {
      saveSettings(contactInfo.email, autoSendEnabled, autoSendTime)
        .catch(console.error);
    }
  }, [autoSendTime]);

  return {
    contactInfo,
    setContactInfo,
    autoSendEnabled,
    setAutoSendEnabled,
    autoSendTime,
    setAutoSendTime,
    savingSettings,
    saveSettingsToDatabase: saveSettings
  };
};
