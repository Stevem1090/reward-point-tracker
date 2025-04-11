
import { EmailSettings } from '@/types/emailSettings';

// This file now contains stub functions that don't interact with the database
// These are kept to avoid breaking any imports, but they don't do anything

export const saveEmailSettingsToDatabase = async (
  email: string, 
  isAutoSend: boolean, 
  timeValue: string = '19:00'
): Promise<void> => {
  console.log('Email settings functionality has been removed');
  // This function now does nothing
  return Promise.resolve();
};

export const loadEmailSettings = async (email: string): Promise<EmailSettings | null> => {
  console.log('Email settings functionality has been removed');
  // This function now returns null
  return Promise.resolve(null);
};
