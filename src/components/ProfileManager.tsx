
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/types/user';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, User, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

type Props = {};

export const ProfileManager: React.FC<Props> = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const { toast } = useToast();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('name');
        
      if (error) throw error;
      
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load profiles",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProfile = async () => {
    if (!newName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a name",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Generate a UUID on the client-side for the profile
      const newProfileId = uuidv4();
      
      const { data: newMember, error } = await supabase
        .from('user_profiles')
        .insert([
          { 
            id: newProfileId,
            name: newName.trim(), 
            color: newColor 
          }
        ])
        .select()
        .single();
        
      if (error) throw error;
      
      setProfiles([...profiles, newMember]);
      setNewName('');
      setNewColor('#6366f1');
      
      toast({
        title: "Success",
        description: "Profile added successfully",
      });
    } catch (error) {
      console.error('Error adding profile:', error);
      toast({
        title: "Error",
        description: "Failed to add profile",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      setIsSubmitting(true);
      
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setProfiles(profiles.filter(member => member.id !== id));
      
      toast({
        title: "Success",
        description: "Profile deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast({
        title: "Error",
        description: "Failed to delete profile",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">User Profiles</h3>
      <p className="text-sm text-muted-foreground">
        Manage user profiles for events and notifications.
      </p>
      
      <Separator />
      
      {isLoading ? (
        <div className="flex justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-kid-purple" />
        </div>
      ) : (
        <div className="space-y-4">
          {profiles.length > 0 ? (
            <div className="space-y-2">
              {profiles.map((profile) => (
                <div 
                  key={profile.id}
                  className="flex items-center justify-between p-2 border rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: profile.color || '#6366f1' }}
                    />
                    <span>{profile.name}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteProfile(profile.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-4 border rounded-md bg-muted/50">
              <User className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No profiles found</p>
            </div>
          )}
          
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium">Add New Profile</h4>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profileName">Name</Label>
                <Input
                  id="profileName"
                  placeholder="Enter name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profileColor">Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="profileColor"
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <Button 
                onClick={handleAddProfile} 
                disabled={isSubmitting || !newName.trim()}
                className="bg-kid-purple hover:bg-purple-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Profile
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileManager;
