
import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PushNotificationToggleProps {
  userIds: string[];
  onSubscriptionChange?: (userId: string, isSubscribed: boolean) => void;
}

// Define NotificationPermission type if it's not available
type NotificationPermissionType = "default" | "denied" | "granted";

const PushNotificationToggle: React.FC<PushNotificationToggleProps> = ({ 
  userIds,
  onSubscriptionChange 
}) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [subscriptionStates, setSubscriptionStates] = useState<{
    id: string;
    isSubscribed: boolean;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionType | null>(null);
  
  // We'll use a single instance of the hook for all operations
  const { 
    isSubscribed: dummy, // We don't use this directly
    isLoading: hookLoading,
    subscribe,
    unsubscribe,
    checkSubscriptionStatus
  } = usePushNotifications("");  // Empty string as initial value
  
  useEffect(() => {
    // Check current notification permission status
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission as NotificationPermissionType);
    }
  }, []);
  
  // Handle loading subscriptions status
  useEffect(() => {
    const loadSubscriptions = async () => {
      if (userIds.length === 0) {
        setSubscriptionStates([]);
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Check subscription status for each user
        const states = await Promise.all(
          userIds.map(async (id) => {
            const isSubscribed = await checkSubscriptionStatus(id);
            return { id, isSubscribed };
          })
        );
        
        setSubscriptionStates(states);
      } catch (error) {
        console.error('Error checking subscription states:', error);
        toast({
          title: "Error",
          description: "Failed to load notification status",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSubscriptions();
  }, [userIds, checkSubscriptionStatus, toast]);

  const allSubscribed = subscriptionStates.length > 0 && subscriptionStates.every(state => state.isSubscribed);
  const someSubscribed = subscriptionStates.some(state => state.isSubscribed);

  const handleRequestPermission = async () => {
    if (isProcessing || isLoading) return;
    
    try {
      setIsProcessing(true);
      
      // Request notification permission explicitly
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        setPermissionStatus(permission as NotificationPermissionType);
        
        if (permission !== 'granted') {
          toast({
            title: "Permission Denied",
            description: "You need to allow notifications in your browser settings to receive reminders.",
            variant: "destructive"
          });
          return;
        }
      }
      
      // Continue with subscription if permission is granted
      await handleToggleAll();
      
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: "Error",
        description: "Failed to request notification permission",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleAll = async () => {
    if (isProcessing || isLoading) return;
    
    try {
      setIsProcessing(true);
      const operation = allSubscribed ? 'unsubscribe' : 'subscribe';
      
      for (const state of subscriptionStates) {
        if (operation === 'subscribe' && !state.isSubscribed) {
          const success = await subscribe(state.id);
          if (success) {
            setSubscriptionStates(prev => 
              prev.map(s => s.id === state.id ? { ...s, isSubscribed: true } : s)
            );
            onSubscriptionChange?.(state.id, true);
          }
        } else if (operation === 'unsubscribe' && state.isSubscribed) {
          const success = await unsubscribe(state.id);
          if (success) {
            setSubscriptionStates(prev => 
              prev.map(s => s.id === state.id ? { ...s, isSubscribed: false } : s)
            );
            onSubscriptionChange?.(state.id, false);
          }
        }
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      toast({
        title: "Error",
        description: "There was a problem managing your notification settings",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (userIds.length === 0) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <BellOff className="h-4 w-4" />
        Select users
      </Button>
    );
  }
  
  if (permissionStatus === 'denied') {
    return (
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Notifications are blocked. Please enable them in your browser settings.
        </AlertDescription>
      </Alert>
    );
  }

  // If permission hasn't been granted yet, show a request button
  if (permissionStatus === 'default') {
    return (
      <Button
        variant="outline"
        onClick={handleRequestPermission}
        disabled={isProcessing}
        className="gap-2"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Bell className="h-4 w-4" />
            Enable Notifications
            <Badge variant="secondary" className="ml-2">
              {userIds.length}
            </Badge>
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={allSubscribed ? "default" : someSubscribed ? "secondary" : "outline"}
      onClick={handleToggleAll}
      disabled={isProcessing || isLoading}
      className="gap-2"
    >
      {isProcessing || isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {isProcessing ? "Processing..." : "Loading..."}
        </>
      ) : allSubscribed ? (
        <>
          <Bell className="h-4 w-4" />
          Notifications Enabled
        </>
      ) : someSubscribed ? (
        <>
          <Bell className="h-4 w-4" />
          Partially Enabled
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4" />
          Enable Notifications
        </>
      )}
      <Badge variant="secondary" className="ml-2">
        {userIds.length}
      </Badge>
    </Button>
  );
};

export default PushNotificationToggle;
