import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Loader2 } from 'lucide-react';
import { useUserNotifications } from '@/hooks/useUserNotifications';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

interface NotificationSettingsProps {
  user: User | null;
}

type NotificationPermissionType = "default" | "denied" | "granted";

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ user }) => {
  const [browserSupport, setBrowserSupport] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionType | null>(null);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const { 
    isSubscribed, 
    isLoading: notificationLoading, 
    subscribe, 
    unsubscribe 
  } = useUserNotifications();
  
  useEffect(() => {
    const fetchNotificationSettings = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch notification settings from user_profiles
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        setEmailNotifications(data?.email_notifications || false);
        setPushNotifications(data?.push_notifications || false);
      } catch (error) {
        console.error('Error fetching notification settings:', error);
        toast({
          title: "Error",
          description: "Could not load notification settings",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }

      // Check browser support and permissions
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setBrowserSupport(false);
        return;
      }

      if ('Notification' in window) {
        setPermissionStatus(Notification.permission as NotificationPermissionType);
      }
    };

    fetchNotificationSettings();
  }, [user, toast]);

  const updateNotificationSettings = async (updates: {
    email_notifications?: boolean;
    push_notifications?: boolean;
  }) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Settings Updated",
        description: "Your notification preferences have been saved",
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast({
        title: "Error",
        description: "Could not update notification settings",
        variant: "destructive"
      });
    }
  };

  const handleEmailNotificationsToggle = async (checked: boolean) => {
    setEmailNotifications(checked);
    await updateNotificationSettings({ email_notifications: checked });
  };

  const handlePushNotificationsToggle = async (checked: boolean) => {
    setPushNotifications(checked);
    
    if (checked) {
      const result = await subscribe();
      if (result.success) {
        await updateNotificationSettings({ push_notifications: true });
      } else {
        // Revert the UI state if subscription fails
        setPushNotifications(false);
      }
    } else {
      await unsubscribe();
      await updateNotificationSettings({ push_notifications: false });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-6">
          <Loader2 className="animate-spin h-6 w-6" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>Manage how you receive notifications</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!browserSupport ? (
            <Alert className="mb-4">
              <AlertDescription>
                Your browser doesn't support push notifications.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Email Notifications Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Email Notifications</div>
                  <div className="text-sm text-muted-foreground">
                    Receive summary emails
                  </div>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={handleEmailNotificationsToggle}
                />
              </div>

              {/* Push Notifications Toggle */}
              <div className="flex items-center justify-between mt-4">
                <div>
                  <div className="font-medium">Push Notifications</div>
                  <div className="text-sm text-muted-foreground">
                    Receive real-time notifications on this device
                  </div>
                </div>
                <Switch
                  checked={pushNotifications}
                  onCheckedChange={handlePushNotificationsToggle}
                  disabled={!browserSupport || permissionStatus === 'denied'}
                />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
