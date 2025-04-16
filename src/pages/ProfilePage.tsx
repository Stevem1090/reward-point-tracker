
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserCircle, Loader2 } from "lucide-react";
import { UserProfile } from '@/types/user';
import { Alert, AlertDescription } from "@/components/ui/alert";
import NotificationSettings from '@/components/NotificationSettings';

const ProfilePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const fetchOrCreateProfile = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Fetching profile for user:', user.id);
        
        // First, try to fetch the profile
        const { data, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        // If profile exists, use it
        if (data) {
          console.log('Profile retrieved successfully:', data);
          setProfile(data as UserProfile);
          setDisplayName(data.name || '');
          return;
        }
        
        // If no profile found, create one
        if (fetchError || !data) {
          console.log('No profile found for user, creating one:', user.id);
          
          const defaultName = user.email?.split('@')[0] || 'User';
          
          const { data: newProfile, error: createError } = await supabase
            .from('user_profiles')
            .insert([{ 
              id: user.id, 
              name: defaultName 
            }])
            .select()
            .single();
          
          if (createError) {
            console.error('Error creating profile:', createError);
            throw new Error('Failed to create your profile. Please try refreshing or contact support.');
          }
          
          console.log('Profile created successfully:', newProfile);
          setProfile(newProfile as UserProfile);
          setDisplayName(newProfile.name || defaultName);
        }
      } catch (err: any) {
        console.error('Unexpected error in profile management:', err);
        setError(err.message || 'An unexpected error occurred. Please try again later.');
        
        // Allow a few retries for transient errors
        if (retryCount < 2) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 1000);
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user || retryCount > 0) {
      fetchOrCreateProfile();
    }
  }, [user, retryCount]);

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
    } catch (error: any) {
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

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
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

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <UserCircle className="h-8 w-8" />
        Profile Settings
      </h1>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {error}
            {retryCount < 3 && (
              <Button variant="link" className="p-0 h-auto ml-2" onClick={handleRetry}>
                Retry
              </Button>
            )}
          </AlertDescription>
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
        
        {user && <NotificationSettings user={user} />}
      </div>
    </div>
  );
};

export default ProfilePage;
