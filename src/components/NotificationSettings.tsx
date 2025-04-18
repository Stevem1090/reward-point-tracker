
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Loader2, Info } from 'lucide-react';
import { useUserNotifications } from '@/hooks/useUserNotifications';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

interface NotificationSettingsProps {
  user: User | null;
}

// Define NotificationPermission type if it's not available
type NotificationPermissionType = "default" | "denied" | "granted";

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ user }) => {
  const [browserSupport, setBrowserSupport] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionType | null>(null);
  const { toast } = useToast();
  
  const { 
    isSubscribed, 
    isLoading: notificationLoading, 
    subscribe, 
    unsubscribe 
  } = useUserNotifications();
  
  useEffect(() => {
    // Check browser support for push notifications
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setBrowserSupport(false);
      return;
    }

    // Check current notification permission status
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission as NotificationPermissionType);
    }
  }, []);
  
  const handleRequestPermission = async () => {
    try {
      // Request notification permission explicitly
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission as NotificationPermissionType);
      
      if (permission === 'granted') {
        // Only try to subscribe if permission is granted
        await handleToggleNotifications();
      } else {
        toast({
          title: "Permission Denied",
          description: "You need to allow notifications in your browser settings to receive reminders.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };
  
  const handleToggleNotifications = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    }
  };
  
  const handleTestNotification = async () => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          title: "Test Notification",
          body: "This is a test notification from your profile page"
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Test notification sent",
        description: "You should receive it shortly"
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: "Error",
        description: "Failed to send test notification",
        variant: "destructive"
      });
    }
  };
  
  const renderPermissionGuidance = () => {
    if (permissionStatus === 'denied') {
      return (
        <Alert variant="destructive" className="mb-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Notification Permission Blocked</AlertTitle>
          <AlertDescription>
            You've blocked notifications for this site. To enable notifications, you need to:
            <ol className="ml-4 mt-2 list-decimal">
              <li>Click the lock/info icon in your browser's address bar</li>
              <li>Find the notifications setting and change it to "Allow"</li>
              <li>Refresh this page</li>
            </ol>
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };
  
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
              {renderPermissionGuidance()}
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">Push Notifications</div>
                  <div className="text-sm text-muted-foreground">
                    Receive notifications on this device
                  </div>
                </div>
                
                {permissionStatus === 'default' ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRequestPermission}
                    disabled={notificationLoading}
                  >
                    {notificationLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Bell className="h-4 w-4 mr-2" />
                    )}
                    Enable Notifications
                  </Button>
                ) : (
                  <Switch 
                    checked={isSubscribed} 
                    onCheckedChange={handleToggleNotifications}
                    disabled={notificationLoading || !browserSupport || permissionStatus === 'denied'}
                  />
                )}
              </div>
              
              {isSubscribed && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleTestNotification}
                  className="mt-2"
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Send Test Notification
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
