
import { useState } from 'react';
import { useToast } from './use-toast';
import { saveEmailSettingsToDatabase } from '@/utils/emailSettingsUtils';

// This hook provides email settings functionality
export const useEmailSettings = () => {
  const [contactInfo, setContactInfo] = useState<{ email: string; whatsapp: string }>({ email: '', whatsapp: '' });
  const [autoSendEnabled, setAutoSendEnabled] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const { toast } = useToast();

  // Function to save settings
  const saveSettingsToDatabase = async () => {
    setSavingSettings(true);
    try {
      // This is a stub function that doesn't actually save to the database
      console.log('Email settings functionality has been removed');
      toast({
        title: "Feature Disabled",
        description: "Email configuration has been disabled in this version.",
        variant: "destructive",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "There was a problem saving your settings.",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
    return Promise.resolve();
  };

  return {
    contactInfo,
    setContactInfo,
    autoSendEnabled,
    setAutoSendEnabled,
    savingSettings,
    saveSettingsToDatabase
  };
};
