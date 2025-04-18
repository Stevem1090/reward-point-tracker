
import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';
import { Badge } from "@/components/ui/badge";

interface PushNotificationToggleProps {
  userIds: string[];
  onSubscriptionChange?: (userId: string, isSubscribed: boolean) => void;
}

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
  
  // We'll use a single instance of the hook for all operations
  const { 
    isSubscribed: dummy, // We don't use this directly
    isLoading: hookLoading,
    subscribe,
    unsubscribe,
    checkSubscriptionStatus
  } = usePushNotifications("");  // Empty string as initial value
  
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
