
import React from 'react';
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from 'lucide-react';
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
  const subscriptionStates = familyMemberIds.map(id => {
    const { isSubscribed, subscribe, unsubscribe } = usePushNotifications(id);
    return { id, isSubscribed, subscribe, unsubscribe };
  });

  const allSubscribed = subscriptionStates.every(state => state.isSubscribed);
  const someSubscribed = subscriptionStates.some(state => state.isSubscribed);

  const handleToggleAll = async () => {
    try {
      const operation = allSubscribed ? 'unsubscribe' : 'subscribe';
      
      for (const state of subscriptionStates) {
        if (operation === 'subscribe' && !state.isSubscribed) {
          await state.subscribe();
          onSubscriptionChange?.(state.id, true);
        } else if (operation === 'unsubscribe' && state.isSubscribed) {
          await state.unsubscribe();
          onSubscriptionChange?.(state.id, false);
        }
      }

      toast({
        title: `Notifications ${allSubscribed ? 'disabled' : 'enabled'}`,
        description: `You will ${allSubscribed ? 'no longer' : 'now'} receive push notifications`,
      });
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      toast({
        title: "Error",
        description: "There was a problem managing your notification settings",
        variant: "destructive",
      });
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
      className="gap-2"
    >
      {allSubscribed ? (
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
