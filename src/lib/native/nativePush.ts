import { supabase } from '@/integrations/supabase/client';
import { FamilyHub, isNativeApp } from './platform';
import type { PushResult } from '@/lib/push/registerPush';

const TOKEN_KEY = 'native-push-token';

async function save(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !token) return false;
  const { error } = await supabase.from('push_tokens').upsert(
    { user_id: user.id, token, platform: 'android', user_agent: navigator.userAgent, last_seen_at: new Date().toISOString() },
    { onConflict: 'user_id,token' }
  );
  if (error) throw error;
  const old = localStorage.getItem(TOKEN_KEY);
  if (old && old !== token) await supabase.from('push_tokens').delete().eq('token', old);
  localStorage.setItem(TOKEN_KEY, token);
  return true;
}

export async function enableNativePush(): Promise<PushResult> {
  try {
    const { granted } = await FamilyHub.requestNotificationPermission();
    if (!granted) return { status: 'denied' };
    localStorage.removeItem('push-disabled');
    const { token } = await FamilyHub.getToken();
    return (await save(token)) ? { status: 'registered' } : { status: 'error', message: 'No device token returned' };
  } catch (e) {
    return { status: 'error', message: (e as Error).message };
  }
}

export async function refreshNativePush() {
  if (!isNativeApp() || localStorage.getItem('push-disabled')) return;
  try {
    const status = await FamilyHub.getStatus();
    if (!status.notificationsGranted) return;
    const { token } = await FamilyHub.getToken();
    await save(token);
  } catch (e) {
    console.error('[native push] refresh failed', e);
  }
}

export async function disableNativePush() {
  localStorage.setItem('push-disabled', '1');
  const token = localStorage.getItem(TOKEN_KEY);
  await FamilyHub.deleteToken().catch(() => undefined);
  if (token) await supabase.from('push_tokens').delete().eq('token', token);
  localStorage.removeItem(TOKEN_KEY);
}

export async function isNativeDeviceEnabled() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return false;
  const status = await FamilyHub.getStatus().catch(() => null);
  if (!status?.notificationsGranted) return false;
  const { data } = await supabase.from('push_tokens').select('id').eq('token', token).maybeSingle();
  return !!data;
}

/** Re-saves the token whenever the app comes back to the front or Firebase rotates it. */
export function startNativeSelfHealing(): () => void {
  const onVisible = () => { if (document.visibilityState === 'visible') refreshNativePush(); };
  document.addEventListener('visibilitychange', onVisible);
  let remove: (() => Promise<void>) | undefined;
  FamilyHub.addListener('tokenRefresh', ({ token }) => {
    if (!localStorage.getItem('push-disabled')) save(token).catch(console.error);
  }).then((h) => { remove = h.remove; }).catch(() => undefined);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    remove?.();
  };
}
