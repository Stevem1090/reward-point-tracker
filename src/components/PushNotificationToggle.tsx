
import React from 'react';
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';
import { Badge } from "@/components/ui/badge";

interface PushNotificationToggleProps {
  familyMemberIds: string[];
  onSubscriptionChange?: (memberId: string, isSubscribed: boolean) => void;
}

const PushNotificationToggle: React.FC<PushNotificationToggleProps> = ({ 
  familyMemberIds,
  onSubscriptionChange 
}) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  // Get subscription state for each family member
  const subscriptionStates = familyMemberIds.map(id => {
    const { isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications(id);
    return { id, isSubscribed, isLoading, subscribe, unsubscribe };
  });

  const allSubscribed = subscriptionStates.length > 0 && subscriptionStates.every(state => state.isSubscribed);
  const someSubscribed = subscriptionStates.some(state => state.isSubscribed);
  const isLoading = subscriptionStates.some(state => state.isLoading);

  const handleToggleAll = async () => {
    if (isProcessing || isLoading) return;
    
    try {
      setIsProcessing(true);
      const operation = allSubscribed ? 'unsubscribe' : 'subscribe';
      
      for (const state of subscriptionStates) {
        if (operation === 'subscribe' && !state.isSubscribed) {
          const success = await state.subscribe();
          if (success) onSubscriptionChange?.(state.id, true);
        } else if (operation === 'unsubscribe' && state.isSubscribed) {
          const success = await state.unsubscribe();
          if (success) onSubscriptionChange?.(state.id, false);
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

  if (familyMemberIds.length === 0) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <BellOff className="h-4 w-4" />
        Select family members
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
        {familyMemberIds.length}
      </Badge>
    </Button>
  );
};

export default PushNotificationToggle;
