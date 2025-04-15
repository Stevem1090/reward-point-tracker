
import React from 'react';
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';

interface PushNotificationToggleProps {
  familyMemberId: string;
}

const PushNotificationToggle: React.FC<PushNotificationToggleProps> = ({ familyMemberId }) => {
  const { isSubscribed, subscribe, unsubscribe } = usePushNotifications(familyMemberId);
  const { toast } = useToast();

  const handleToggleSubscription = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
        toast({
          title: "Notifications disabled",
          description: "You will no longer receive push notifications",
        });
      } else {
        await subscribe();
        toast({
          title: "Notifications enabled",
          description: "You will now receive push notifications",
        });
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      toast({
        title: "Error",
        description: "There was a problem managing your notification settings",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant={isSubscribed ? "default" : "outline"}
      onClick={handleToggleSubscription}
      className="gap-2"
    >
      {isSubscribed ? (
        <>
          <Bell className="h-4 w-4" />
          Disable Notifications
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4" />
          Enable Notifications
        </>
      )}
    </Button>
  );
};

export default PushNotificationToggle;
