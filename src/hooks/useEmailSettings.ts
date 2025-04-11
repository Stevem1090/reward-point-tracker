
import { useState } from 'react';

// This hook now contains stub functions that don't do anything
// It's kept to avoid breaking any imports, but the functionality is removed

export const useEmailSettings = () => {
  const [contactInfo] = useState<{ email: string; whatsapp: string }>({ email: '', whatsapp: '' });
  const [autoSendEnabled] = useState<boolean>(false);
  const [savingSettings] = useState(false);

  // Empty function stubs
  const saveSettings = async () => {
    console.log('Email settings functionality has been removed');
    return Promise.resolve();
  };

  return {
    contactInfo,
    setContactInfo: () => {}, // Stub function
    autoSendEnabled,
    setAutoSendEnabled: () => {}, // Stub function
    savingSettings,
    saveSettingsToDatabase: saveSettings
  };
};
