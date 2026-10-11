import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isNativeApp } from '@/lib/native/platform';
import { syncBackupReminders } from '@/lib/native/backupReminders';

/** Android-app-only glue: back button, opening a task from a notification, backup reminders. */
const NativeAppBridgeInner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Hardware back button: go back, or leave the app from the dashboard.
  useEffect(() => {
    let remove: (() => void) | undefined;
    import('@capacitor/app').then(({ App }) =>
      App.addListener('backButton', () => {
        if (window.location.pathname === '/' || window.location.pathname === '/login') App.exitApp();
        else navigate(-1);
      }).then((h) => { remove = () => h.remove(); })
    );
    return () => remove?.();
  }, [navigate]);

  // The native side asks the page to open a task by dispatching this event.
  useEffect(() => {
    const open = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (typeof url === 'string' && url.startsWith('/')) navigate(url);
    };
    window.addEventListener('familyhub:open', open);
    return () => window.removeEventListener('familyhub:open', open);
  }, [navigate]);

  // Keep the phone's backup copies of upcoming reminders current.
  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').order('sort_order').order('created_at');
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (user?.id && tasks) syncBackupReminders(tasks as never, user.id);
  }, [tasks, user?.id, location.pathname]);

  return null;
};

const NativeAppBridge = () => (isNativeApp() ? <NativeAppBridgeInner /> : null);
export default NativeAppBridge;
