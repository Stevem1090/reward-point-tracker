import React, { useEffect, useState } from 'react';
import { Bell, Loader2, Send, Smartphone, Share, PlusSquare, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  enablePush, disablePush, isThisDeviceEnabled, sendTestPush,
  getPushPermission, isInIframe, isIOS, isStandalone,
} from '@/lib/push/registerPush';

export const InstallAppCard: React.FC = () => {
  if (isStandalone()) return null;
  const ios = isIOS();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg"><Smartphone className="h-5 w-5" /> Install the app</CardTitle>
        <CardDescription>Add Family Hub to your home screen for a full-screen app and notifications.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {ios ? (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Open this page in <strong>Safari</strong>.</li>
            <li>Tap <Share className="inline h-4 w-4" /> <strong>Share</strong>.</li>
            <li>Tap <PlusSquare className="inline h-4 w-4" /> <strong>Add to Home Screen</strong>.</li>
            <li>Open Family Hub from your home screen, then turn on notifications here.</li>
          </ol>
        ) : (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Open this page in <strong>Chrome</strong>.</li>
            <li>Tap <MoreVertical className="inline h-4 w-4" /> the menu.</li>
            <li>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</li>
          </ol>
        )}
      </CardContent>
    </Card>
  );
};

const NotificationSettings: React.FC<{ user?: unknown }> = () => {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const perm = getPushPermission();
  const iosNeedsInstall = isIOS() && !isStandalone();

  useEffect(() => { isThisDeviceEnabled().then(setEnabled); }, []);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (!on) {
        await disablePush();
        setEnabled(false);
        toast({ title: 'Notifications turned off on this device' });
        return;
      }
      const r = await enablePush();
      const messages: Record<string, string> = {
        'open-in-new-tab': 'Notifications can\'t be turned on inside the editor preview. Open the app in its own tab or from your home screen.',
        denied: 'Notifications are blocked. Allow them for this site in your browser or phone settings, then try again.',
        unsupported: iosNeedsInstall ? 'On iPhone, add the app to your Home Screen first, then open it from there.' : 'This browser doesn\'t support notifications.',
        'not-configured': 'Notifications aren\'t set up yet.',
      };
      if (r.status === 'registered') {
        setEnabled(true);
        toast({ title: 'Notifications on', description: 'This device will now get reminders.' });
      } else {
        toast({ title: 'Couldn\'t turn on notifications', description: messages[r.status] ?? r.message, variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await sendTestPush();
      toast({ title: 'Test sent', description: `Sent to ${r.sent} of your device${r.devices === 1 ? '' : 's'}.` });
    } catch (e) {
      toast({ title: 'Test failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <InstallAppCard />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Bell className="h-5 w-5" /> Notifications</CardTitle>
          <CardDescription>Get task reminders, weekly reminders and defrost alerts on this device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInIframe() && (
            <Alert><AlertDescription>Open the app in its own tab (or from your home screen) to turn on notifications.</AlertDescription></Alert>
          )}
          {iosNeedsInstall && !isInIframe() && (
            <Alert><AlertDescription>On iPhone, notifications only work after adding the app to your Home Screen.</AlertDescription></Alert>
          )}
          {perm === 'denied' && (
            <Alert variant="destructive"><AlertDescription>Notifications are blocked for this site. Re-allow them in your browser or phone settings.</AlertDescription></Alert>
          )}
          <div className="flex items-center justify-between min-h-[44px]">
            <span className="font-medium">Notifications on this device</span>
            <div className="flex items-center gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              <Switch checked={enabled} disabled={busy} onCheckedChange={toggle} aria-label="Notifications on this device" />
            </div>
          </div>
          {enabled && (
            <Button variant="outline" onClick={test} disabled={testing} className="min-h-[44px]">
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send test notification
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationSettings;
