
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Loader2, RefreshCw } from 'lucide-react';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { 
    isSubscribed, 
    isLoading: notificationLoading, 
    subscribe, 
    unsubscribe 
  } = useUserNotifications();
  
  const fetchNotificationSettings = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setFetchError(null);

    try {
      // Set a timeout for the fetch operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database request timed out')), 5000);
      });

      // Fetch notification settings from user_profiles
      const fetchPromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Race between the fetch and the timeout
      const { data, error } = await Promise.race([
        fetchPromise,
        timeoutPromise.then(() => { throw new Error('Database request timed out'); })
      ]) as any;

      if (error) throw error;

      setEmailNotifications(data?.email_notifications || false);
      setPushNotifications(data?.push_notifications || false);
    } catch (error: any) {
      console.error('Error fetching notification settings:', error);
      setFetchError(error.message || 'Failed to load settings');
      // Still set default values so UI isn't broken
      setEmailNotifications(false);
      setPushNotifications(false);
      
      toast({
        title: "Error",
        description: "Could not load notification settings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
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

  useEffect(() => {
    // Initial fetch
    fetchNotificationSettings();
    
    // Set a timeout to ensure we don't get stuck in loading state
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setFetchError('Loading timed out. Please try refreshing.');
      }
    }, 7000);
    
    return () => clearTimeout(loadingTimeout);
  }, [user]);

  const updateNotificationSettings = async (updates: {
    email_notifications?: boolean;
    push_notifications?: boolean;
  }) => {
    if (!user) return;

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Update request timed out')), 5000);
      });
      
      const updatePromise = supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
        
      // Race between the update and the timeout
      const { error } = await Promise.race([
        updatePromise,
        timeoutPromise.then(() => { throw new Error('Update request timed out'); })
      ]) as any;

      if (error) throw error;

      toast({
        title: "Settings Updated",
        description: "Your notification preferences have been saved",
      });
    } catch (error: any) {
      console.error('Error updating notification settings:', error);
      toast({
        title: "Error",
        description: error.message || "Could not update notification settings",
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

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchNotificationSettings();
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
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>Manage how you receive notifications</CardDescription>
        </div>
        {(fetchError || isRefreshing) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="ml-1">{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {fetchError && (
          <Alert className="mb-4">
            <AlertDescription>
              {fetchError}
            </AlertDescription>
          </Alert>
        )}
        
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
