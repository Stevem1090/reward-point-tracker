import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';

type UserProfile = {
  id: string;
  name: string | null;
  color: string | null;
  created_at: string;
};

type EventType = {
  id?: string;
  title: string;
  description: string | null;
  start_time: Date;
  end_time: Date;
  type: string;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  members: string[];
};

const EVENT_TYPES = [
  { id: 'school', name: 'School', color: 'bg-kid-blue' },
  { id: 'appointment', name: 'Appointment', color: 'bg-kid-purple' },
  { id: 'sport', name: 'Sport', color: 'bg-kid-green' },
  { id: 'family', name: 'Family', color: 'bg-kid-orange' },
  { id: 'lesson', name: 'Lesson', color: 'bg-kid-yellow' },
  { id: 'work', name: 'Work', color: 'bg-blue-500' },
  { id: 'other', name: 'Other', color: 'bg-gray-500' }
];

interface EventFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
  editEvent?: EventType | null;
  onSave: () => void;
}

export function EventForm({ isOpen, onClose, initialDate = new Date(), editEvent = null, onSave }: EventFormProps) {
  const [event, setEvent] = useState<EventType>({
    title: '',
    description: '',
    start_time: initialDate,
    end_time: new Date(initialDate.getTime() + 60 * 60 * 1000),
    type: 'other',
    is_recurring: false,
    recurrence_pattern: null,
    members: [],
  });
  
  const [startDate, setStartDate] = useState<Date>(initialDate);
  const [startTime, setStartTime] = useState<string>(format(initialDate, 'HH:mm'));
  const [endDate, setEndDate] = useState<Date>(new Date(initialDate.getTime() + 60 * 60 * 1000));
  const [endTime, setEndTime] = useState<string>(format(new Date(initialDate.getTime() + 60 * 60 * 1000), 'HH:mm'));
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingProfiles, setFetchingProfiles] = useState(true);
  const { user } = useAuth();
  
  const { toast } = useToast();

  useEffect(() => {
    fetchUserProfiles();
    
    if (editEvent) {
      setEvent(editEvent);
      setStartDate(new Date(editEvent.start_time));
      setEndDate(new Date(editEvent.end_time));
      setStartTime(format(new Date(editEvent.start_time), 'HH:mm'));
      setEndTime(format(new Date(editEvent.end_time), 'HH:mm'));
    } else {
      setEvent({
        title: '',
        description: '',
        start_time: initialDate,
        end_time: new Date(initialDate.getTime() + 60 * 60 * 1000),
        type: 'other',
        is_recurring: false,
        recurrence_pattern: null,
        members: user ? [user.id] : [],
      });
      setStartDate(initialDate);
      setEndDate(new Date(initialDate.getTime() + 60 * 60 * 1000));
      setStartTime(format(initialDate, 'HH:mm'));
      setEndTime(format(new Date(initialDate.getTime() + 60 * 60 * 1000), 'HH:mm'));
    }
  }, [isOpen, initialDate, editEvent, user]);

  const fetchUserProfiles = async () => {
    try {
      setFetchingProfiles(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('name');
        
      if (error) throw error;
      
      const profilesWithColors = data?.map(profile => ({
        ...profile,
        color: profile.color || '#6366f1'
      })) || [];
      
      setUserProfiles(profilesWithColors);
    } catch (error) {
      console.error('Error fetching user profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load user profiles",
        variant: "destructive",
      });
    } finally {
      setFetchingProfiles(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!event.title.trim()) {
        toast({
          title: "Error",
          description: "Please enter a title for the event",
          variant: "destructive",
        });
        return;
      }

      const startDateTime = new Date(startDate);
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      startDateTime.setHours(startHours, startMinutes, 0, 0);

      const endDateTime = new Date(endDate);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      endDateTime.setHours(endHours, endMinutes, 0, 0);

      if (startDateTime >= endDateTime) {
        toast({
          title: "Error",
          description: "End time must be after start time",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      const eventData = {
        title: event.title.trim(),
        description: event.description?.trim() || null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        type: event.type,
        is_recurring: event.is_recurring,
        recurrence_pattern: event.recurrence_pattern,
        owner_ids: event.members,
      };

      if (editEvent) {
        const { error: updateError } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', event.id);
          
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('events')
          .insert(eventData);
          
        if (insertError) throw insertError;
      }

      toast({
        title: "Success",
        description: editEvent ? "Event updated successfully" : "Event created successfully",
      });

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: "Error",
        description: "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMemberToggle = (profileId: string) => {
    setEvent(prev => {
      const isSelected = prev.members.includes(profileId);
      
      if (isSelected) {
        return {
          ...prev,
          members: prev.members.filter(id => id !== profileId)
        };
      } else {
        return {
          ...prev,
          members: [...prev.members, profileId]
        };
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={event.title}
              onChange={(e) => setEvent({ ...event, title: e.target.value })}
              placeholder="Event title"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={event.description || ''}
              onChange={(e) => setEvent({ ...event, description: e.target.value })}
              placeholder="Event description"
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <Label>Event Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES.map(type => (
                <div
                  key={type.id}
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer border-2 ${event.type === type.id ? 'border-kid-purple' : 'border-transparent'}`}
                  onClick={() => setEvent({ ...event, type: type.id })}
                >
                  <div className={`w-3 h-3 rounded-full ${type.color}`}></div>
                  <span>{type.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
                initialFocus
                className="border rounded-md"
              />
            </div>
            <div className="grid gap-2">
              <Label>End Date</Label>
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setEndDate(date)}
                initialFocus
                className="border rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isRecurring"
              checked={event.is_recurring}
              onCheckedChange={(checked) => 
                setEvent({ 
                  ...event, 
                  is_recurring: checked as boolean,
                  recurrence_pattern: checked ? event.recurrence_pattern || 'weekly' : null
                })
              }
            />
            <Label htmlFor="isRecurring">This is a recurring event</Label>
          </div>

          {event.is_recurring && (
            <div className="grid gap-2">
              <Label htmlFor="recurrence">Repeats</Label>
              <select
                id="recurrence"
                value={event.recurrence_pattern || 'weekly'}
                onChange={(e) => setEvent({ ...event, recurrence_pattern: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Participants</Label>
            {fetchingProfiles ? (
              <div className="flex justify-center p-2">
                <Loader2 className="animate-spin h-4 w-4" />
              </div>
            ) : userProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {userProfiles.map(profile => (
                  <div 
                    key={profile.id}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer border ${event.members.includes(profile.id) ? 'border-kid-purple bg-purple-50' : 'border-gray-200'}`}
                    onClick={() => handleMemberToggle(profile.id)}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: profile.color }}></div>
                    <span className="text-sm">{profile.name}</span>
                    {profile.id === user?.id && (
                      <span className="text-xs bg-kid-purple/20 text-kid-purple px-1.5 py-0.5 rounded-full">You</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-kid-purple hover:bg-purple-700" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {editEvent ? 'Update' : 'Add'} Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
