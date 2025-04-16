
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Bell, UserCircle, Loader2 } from "lucide-react";
import { useUserNotifications } from '@/hooks/useUserNotifications';
import { UserProfile } from '@/types/user';
import { Alert, AlertDescription } from "@/components/ui/alert";

const ProfilePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserSupport, setBrowserSupport] = useState(true);

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

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Fetching profile for user:', user.id);
        
        // Only attempt to fetch the profile, not create one
        const { data, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            // No profile found - this shouldn't happen as profile should be created during signup
            console.error('No profile found for user. This suggests a signup issue:', fetchError);
            setError('Your profile could not be found. Please contact support.');
          } else {
            console.error('Error fetching profile:', fetchError);
            setError('Failed to load profile data. Please try refreshing the page.');
          }
          setIsLoading(false);
          return;
        }

        console.log('Profile retrieved successfully:', data);
        setProfile(data as UserProfile);
        setDisplayName(data.name || '');
      } catch (err) {
        console.error('Unexpected error in profile management:', err);
        setError('An unexpected error occurred. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    
    try {
      setIsSaving(true);
      setError(null);
      
      console.log('Updating profile for user:', user.id);
      const { error } = await supabase
        .from('user_profiles')
        .update({ name: displayName })
        .eq('id', user.id);
      
      if (error) {
        console.error('Error saving profile:', error);
        throw error;
      }
      
      setProfile({
        ...profile,
        name: displayName
      });
      
      toast({
        title: "Profile saved",
        description: "Your profile has been updated successfully"
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save profile. Please try again later.');
      toast({
        title: "Error saving profile",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
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

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // If no profile was found, show an error message
  if (!profile && !isLoading) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {error || "Your profile could not be loaded. This may indicate an issue with your account setup. Please try signing out and back in, or contact support."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <UserCircle className="h-8 w-8" />
        Profile Settings
      </h1>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ''} readOnly className="bg-muted" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input 
                  id="displayName" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleSaveProfile} 
              disabled={isSaving || displayName === profile?.name}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
        
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
      </div>
    </div>
  );
};

export default ProfilePage;
