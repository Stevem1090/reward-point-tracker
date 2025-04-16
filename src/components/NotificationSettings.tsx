
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Loader2 } from "lucide-react";
import { useUserNotifications } from '@/hooks/useUserNotifications';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

interface NotificationSettingsProps {
  user: User | null;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ user }) => {
  const [browserSupport, setBrowserSupport] = useState(true);
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
    }
  }, []);
  
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
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">Push Notifications</div>
                  <div className="text-sm text-muted-foreground">
                    Receive notifications on this device
                  </div>
                </div>
                <Switch 
                  checked={isSubscribed} 
                  onCheckedChange={handleToggleNotifications}
                  disabled={notificationLoading || !browserSupport}
                />
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
