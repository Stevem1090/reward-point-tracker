
import React, { useState, useEffect, useCallback } from 'react';
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
  
  // Memoize the fetch function to avoid recreation on each render
  const fetchNotificationSettings = useCallback(async () => {
    if (!user) {
      console.log("No user found, skipping notification settings fetch");
      setIsLoading(false);
      return;
    }

    setFetchError(null);

    try {
      console.log("Fetching notification settings for user:", user.id);
      
      // Even shorter timeout for faster feedback
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database request timed out')), 3000);
      });

      // Fetch notification settings from user_profiles
      const fetchPromise = supabase
        .from('user_profiles')
        .select('email_notifications, push_notifications')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors if no record

      // Race between the fetch and the timeout
      let raceResult;
      try {
        raceResult = await Promise.race([
          fetchPromise,
          timeoutPromise
        ]);
      } catch (raceError) {
        console.log("Race promise rejected:", raceError);
        throw raceError;
      }

      const { data, error } = raceResult;

      if (error) {
        console.error("Error fetching notification settings:", error);
        throw error;
      }

      console.log("Received notification settings:", data);
      
      // Safely set the values with explicit boolean conversion
      setEmailNotifications(data?.email_notifications === true);
      setPushNotifications(data?.push_notifications === true);
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

    // Check browser support and permissions - do this outside the try/catch
    // so it doesn't interfere with the main data fetch
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log("Browser doesn't support push notifications");
      setBrowserSupport(false);
      return;
    }

    if ('Notification' in window) {
      const permission = Notification.permission as NotificationPermissionType;
      console.log("Notification permission status:", permission);
      setPermissionStatus(permission);
    }
  }, [user, toast]); // Only depend on user and toast

  useEffect(() => {
    // Initial fetch with safety check
    if (user?.id) {
      console.log("User authenticated, fetching notification settings");
      fetchNotificationSettings();
    } else {
      console.log("No authenticated user found");
      setIsLoading(false);
    }
    
    // Set a shorter timeout to ensure we don't get stuck in loading state
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        console.log("Loading timed out, showing error");
        setIsLoading(false);
        setFetchError('Loading timed out. Please try refreshing.');
      }
    }, 3500); // Even shorter timeout for faster feedback
    
    return () => clearTimeout(loadingTimeout);
  }, [user, fetchNotificationSettings]);

  const updateNotificationSettings = async (updates: {
    email_notifications?: boolean;
    push_notifications?: boolean;
  }) => {
    if (!user) {
      console.log("No user found, can't update settings");
      return;
    }

    try {
      console.log("Updating notification settings:", updates);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Update request timed out')), 3000);
      });
      
      const updatePromise = supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
        
      // Race between the update and the timeout with explicit error handling
      let raceResult;
      try {
        raceResult = await Promise.race([
          updatePromise,
          timeoutPromise
        ]);
      } catch (raceError) {
        console.log("Race promise rejected during update:", raceError);
        throw raceError;
      }
      
      const { error } = raceResult;

      if (error) {
        console.error("Error updating notification settings:", error);
        throw error;
      }

      console.log("Settings updated successfully");
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
      console.log("Attempting to subscribe to push notifications");
      const result = await subscribe();
      if (result.success) {
        await updateNotificationSettings({ push_notifications: true });
      } else {
        // Revert the UI state if subscription fails
        console.error("Push notification subscription failed:", result.message);
        setPushNotifications(false);
      }
    } else {
      console.log("Unsubscribing from push notifications");
      await unsubscribe();
      await updateNotificationSettings({ push_notifications: false });
    }
  };

  const handleRefresh = () => {
    console.log("Refreshing notification settings");
    setIsRefreshing(true);
    fetchNotificationSettings();
  };

  // Special handling for when user is null
  if (!user) {
    return (
      <Card>
        <CardContent className="flex flex-col justify-center items-center py-6">
          <Alert>
            <AlertDescription>
              You need to be logged in to manage notification settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

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
