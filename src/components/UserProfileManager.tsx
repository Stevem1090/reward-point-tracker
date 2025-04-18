import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserCircle, Loader2 } from "lucide-react";
import { UserProfile } from '@/types/user';

type Props = {};

export const UserProfileManager: React.FC<Props> = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching profile:', error);
          setError('Failed to load profile. Please try again later.');
          return;
        }
        
        setProfile(data as UserProfile);
        setDisplayName(data.name || '');
      } catch (error: any) {
        console.error('Unexpected error:', error);
        setError(error.message || 'An unexpected error occurred. Please try again later.');
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
      
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          name: displayName,
          color: profile.color 
        })
        .eq('id', user.id);
    
      if (error) throw error;
    
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

  return (
    <Card className="w-full max-w-md">
      <CardContent>
        <CardTitle className="text-kid-purple flex items-center gap-2">
          <UserCircle className="h-5 w-5 mr-2" />
          User Profile
        </CardTitle>
        {error && (
          <div className="text-red-500 mt-4">
            {error}
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center items-center py-4">
            <Loader2 className="animate-spin h-6 w-6 text-kid-purple" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ''} readOnly className="bg-gray-100" />
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
            <Button 
              onClick={handleSaveProfile} 
              disabled={isSaving || displayName === profile?.name}
              className="bg-kid-purple hover:bg-purple-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : "Save Changes"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
