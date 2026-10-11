import { Capacitor, registerPlugin } from '@capacitor/core';

/** True only inside the Family Hub Android app (never in the browser or PWA). */
export const isNativeApp = () => Capacitor.isNativePlatform();

export type NativeStatus = {
  notificationsGranted: boolean;
  batteryUnrestricted: boolean;
  exactAlarms: boolean;
  manufacturer: string;
};

export type BackupReminder = { taskId: string; title: string; body: string; dueAt: number; url: string };

/** Custom native module shipped inside the APK (native/android/...). */
export interface FamilyHubPlugin {
  getToken(): Promise<{ token: string }>;
  deleteToken(): Promise<void>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  getStatus(): Promise<NativeStatus>;
  openBatterySettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  syncReminders(options: { reminders: BackupReminder[] }): Promise<{ scheduled: number }>;
  addListener(event: 'tokenRefresh', cb: (d: { token: string }) => void): Promise<{ remove: () => Promise<void> }>;
}

export const FamilyHub = registerPlugin<FamilyHubPlugin>('FamilyHub');

/** Saves a file: normal download on the web, share sheet in the Android app. */
export async function saveFile(blob: Blob, filename: string) {
  if (!isNativeApp()) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  await Share.share({ title: filename, files: [uri] });
}
