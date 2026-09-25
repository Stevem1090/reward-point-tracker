import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, deleteToken, isSupported, type Messaging } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';

const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID as string | undefined;
const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY as string | undefined;
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY as string) ?? '',
  projectId: (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string) ?? '',
  appId: appId ?? '',
  messagingSenderId: appId?.split(':')[1] ?? '',
};

const SW_SCOPE = '/firebase-cloud-messaging-push-scope';

export type PushResult =
  | { status: 'registered' }
  | { status: 'not-configured' | 'unsupported' | 'open-in-new-tab' | 'denied' | 'error'; message?: string };

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

const isConfigured = () =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && firebaseConfig.messagingSenderId && vapidKey);

export const isInIframe = () => {
  try { return window.self !== window.top; } catch { return true; }
};

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

export function getPushPermission(): 'unsupported' | NotificationPermission {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission;
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messaging) return messaging;
  if (!isConfigured() || !(await isSupported().catch(() => false))) return null;
  app = app ?? initializeApp(firebaseConfig);
  messaging = getMessaging(app);
  return messaging;
}

async function registerSW() {
  const query = new URLSearchParams(firebaseConfig).toString();
  const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`, { scope: SW_SCOPE });
  if (!reg.active) {
    const sw = reg.installing || reg.waiting;
    if (sw) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 10000);
        sw.addEventListener('statechange', () => { if (sw.state === 'activated') { clearTimeout(t); resolve(); } });
      });
    }
  }
  return reg;
}

async function saveToken(): Promise<boolean> {
  const m = await getMessagingInstance();
  if (!m) return false;
  const reg = await registerSW();
  const token = await getToken(m, { vapidKey, serviceWorkerRegistration: reg });
  if (!token) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('push_tokens').upsert(
    { user_id: user.id, token, platform: 'web', user_agent: navigator.userAgent, last_seen_at: new Date().toISOString() },
    { onConflict: 'user_id,token' }
  );
  if (error) throw error;
  localStorage.setItem('push-token', token);
  return true;
}

/** Call from a button tap: browsers ignore permission requests without a user action. */
export async function enablePush(): Promise<PushResult> {
  if (!isConfigured()) return { status: 'not-configured' };
  if (getPushPermission() === 'unsupported' || !(await isSupported().catch(() => false))) return { status: 'unsupported' };
  if (isInIframe()) return { status: 'open-in-new-tab' };
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return { status: 'denied' };
  try {
    localStorage.removeItem('push-disabled');
    return (await saveToken()) ? { status: 'registered' } : { status: 'error', message: 'No device token returned' };
  } catch (e) {
    console.error('[push] enable failed', e);
    return { status: 'error', message: (e as Error).message };
  }
}

/** Silently re-saves this device's token (FCM rotates them). Never prompts. */
export async function refreshPushToken() {
  if (isInIframe() || getPushPermission() !== 'granted' || localStorage.getItem('push-disabled')) return;
  try { await saveToken(); } catch (e) { console.error('[push] refresh failed', e); }
}

export async function disablePush() {
  localStorage.setItem('push-disabled', '1');
  const token = localStorage.getItem('push-token');
  try {
    const m = await getMessagingInstance();
    if (m) await deleteToken(m).catch(() => undefined);
  } catch { /* ignore */ }
  if (token) await supabase.from('push_tokens').delete().eq('token', token);
  localStorage.removeItem('push-token');
}

/** Is this device currently receiving notifications? */
export async function isThisDeviceEnabled(): Promise<boolean> {
  const token = localStorage.getItem('push-token');
  if (!token || getPushPermission() !== 'granted') return false;
  const { data } = await supabase.from('push_tokens').select('id').eq('token', token).maybeSingle();
  return !!data;
}

export async function sendTestPush() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase.functions.invoke('send-push-notification', {
    body: { userIds: [user.id], title: 'Family Hub', body: 'Notifications are working 🎉', url: '/tasks' },
  });
  if (error) throw error;
  return data as { sent: number; devices: number };
}

/** Removes the old notification worker (/sw.js) left from the previous system. */
export async function retireOldServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || '';
      if (url.endsWith('/sw.js')) await r.unregister();
    }
  } catch { /* ignore */ }
}
