
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { X, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

type UserProfile = {
  id: string;
  name: string;
  color: string;
};

export const UserProfileManager = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('name');
        
      if (error) throw error;
      
      // Add default color if not present
      const profilesWithColors = data?.map(profile => ({
        ...profile,
        color: profile.color || '#6366f1'
      })) || [];
      
      setProfiles(profilesWithColors);
    } catch (error) {
      console.error('Error fetching user profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load user profiles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfileColor = async (id: string, color: string) => {
    if (!color) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('user_profiles')
        .update({ color })
        .eq('id', id);
        
      if (error) throw error;
      
      setProfiles(profiles.map(profile => 
        profile.id === id ? { ...profile, color } : profile
      ));
      
      toast({
        title: "Success",
        description: "Profile color updated",
      });
    } catch (error) {
      console.error('Error updating profile color:', error);
      toast({
        title: "Error",
        description: "Failed to update profile color",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-kid-purple flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          User Profiles
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center my-4">
            <Loader2 className="animate-spin h-6 w-6 text-kid-purple" />
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {profiles.length === 0 ? (
                <p className="text-muted-foreground text-center py-2">No user profiles found</p>
              ) : (
                profiles.map(profile => (
                  <div key={profile.id} className="flex items-center justify-between p-2 rounded-md bg-background border">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: profile.color }}></div>
                      <span>{profile.name}</span>
                      {profile.id === user?.id && (
                        <span className="text-xs bg-kid-purple/20 text-kid-purple px-1.5 py-0.5 rounded-full">You</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={profile.color}
                        onChange={(e) => updateProfileColor(profile.id, e.target.value)}
                        className="w-8 h-8 p-1 rounded-md cursor-pointer"
                        disabled={saving}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 text-sm text-muted-foreground text-center">
              <p>User profiles are created automatically when users sign up.</p>
              <p>You can customize profile colors above.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
