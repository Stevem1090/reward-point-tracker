
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { X, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FamilyMember = {
  id: string;
  name: string;
  color: string;
};

export const FamilyMemberManager = () => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberColor, setNewMemberColor] = useState('#6366f1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching family members:', error);
      toast({
        title: "Error",
        description: "Failed to load family members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addMember = async () => {
    if (!newMemberName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the family member",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('family_members')
        .insert([
          { name: newMemberName.trim(), color: newMemberColor }
        ])
        .select();
        
      if (error) throw error;
      
      setMembers([...members, ...data]);
      setNewMemberName('');
      toast({
        title: "Success",
        description: "Family member added successfully",
      });
    } catch (error) {
      console.error('Error adding family member:', error);
      toast({
        title: "Error",
        description: "Failed to add family member",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteMember = async (id: string) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setMembers(members.filter(member => member.id !== id));
      toast({
        title: "Success",
        description: "Family member removed successfully",
      });
    } catch (error) {
      console.error('Error deleting family member:', error);
      toast({
        title: "Error",
        description: "Failed to delete family member",
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
          Family Members
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
              {members.length === 0 ? (
                <p className="text-muted-foreground text-center py-2">No family members added yet</p>
              ) : (
                members.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-md bg-background border">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: member.color }}></div>
                      <span>{member.name}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => deleteMember(member.id)}
                      disabled={saving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <Input
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Name"
                className="flex-1"
              />
              <Input
                type="color"
                value={newMemberColor}
                onChange={(e) => setNewMemberColor(e.target.value)}
                className="w-16 p-1 h-10"
              />
              <Button 
                onClick={addMember} 
                disabled={saving || !newMemberName.trim()}
                className="bg-kid-purple hover:bg-purple-700"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
