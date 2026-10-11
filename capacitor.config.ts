import type { CapacitorConfig } from '@capacitor/cli';

// Private Android app for the family. It loads the published Family Hub site,
// so web changes appear in the app without reinstalling.
const config: CapacitorConfig = {
  appId: 'app.lovable.p6d6906c6162c45aeb91047ebf987bb28',
  appName: 'Family Hub',
  webDir: 'dist',
  server: {
    url: 'https://reward-point-tracker.lovable.app',
    androidScheme: 'https',
    allowNavigation: ['reward-point-tracker.lovable.app', '*.supabase.co'],
  },
  android: {
    backgroundColor: '#ffffff',
  },
};

export default config;
