import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FamilyHub, isNativeApp, type NativeStatus } from '@/lib/native/platform';

const Row: React.FC<{ ok: boolean; label: string; help: string; action?: React.ReactNode }> = ({ ok, label, help, action }) => (
  <div className="flex items-start gap-3 min-h-[44px]">
    {ok ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
    <div className="flex-1 min-w-0">
      <p className="font-medium">{label}</p>
      {!ok && <p className="text-sm text-muted-foreground">{help}</p>}
    </div>
    {!ok && action}
  </div>
);

/** Android app only: checks the phone settings that make reminders arrive on time. */
const AndroidHealthCard: React.FC = () => {
  const [status, setStatus] = useState<NativeStatus | null>(null);
  const refresh = useCallback(() => { FamilyHub.getStatus().then(setStatus).catch(() => setStatus(null)); }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  if (!isNativeApp() || !status) return null;
  const samsung = /samsung/i.test(status.manufacturer);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5" /> Reminder health</CardTitle>
        <CardDescription>All three should be green so reminders always arrive on time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row
          ok={status.notificationsGranted}
          label="Notifications allowed"
          help="Family Hub isn't allowed to show notifications."
          action={<Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => FamilyHub.requestNotificationPermission().then(refresh)}>Allow</Button>}
        />
        <Row
          ok={status.batteryUnrestricted}
          label="Battery: Unrestricted"
          help={samsung
            ? 'Set battery to Unrestricted. Also: Settings › Battery › Background usage limits › Never sleeping apps › add Family Hub.'
            : 'Set battery usage to Unrestricted so Android never delays reminders.'}
          action={<Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => FamilyHub.openBatterySettings()}>Fix</Button>}
        />
        <Row
          ok={status.exactAlarms}
          label="On-time backup reminders"
          help="Allow 'Alarms & reminders' so the backup copy fires at the exact minute."
          action={<Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => FamilyHub.openNotificationSettings()}>Fix</Button>}
        />
      </CardContent>
    </Card>
  );
};

export default AndroidHealthCard;
