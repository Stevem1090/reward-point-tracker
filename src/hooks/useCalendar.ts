
import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserProfile } from '@/types/user';

type Event = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  type: string;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  owner_ids: string[];
  profiles?: UserProfile[]; // User profiles associated with the event
};

// Type definition for the EventForm component
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

export const useCalendar = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const { toast } = useToast();

  // Generate an array of dates for the current week
  const getWeekDays = (date: Date) => {
    const start = startOfWeek(date, { weekStartsOn: 1 }); // Start from Monday
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const weekDays = getWeekDays(currentDate);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      const weekStart = weekDays[0];
      const weekEnd = addDays(weekDays[6], 1);
      
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .or(`start_time.gte.${weekStart.toISOString()},end_time.lte.${weekEnd.toISOString()}`)
        .order('start_time');
        
      if (eventsError) throw eventsError;
      
      // Get all user profiles for event members
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*');
        
      if (profilesError) throw profilesError;
      
      // Attach profiles to events for easier access
      const eventsWithProfiles = eventsData?.map(event => ({
        ...event,
        profiles: profiles?.filter(profile => event.owner_ids?.includes(profile.id)) || []
      })) || [];
      
      setEvents(eventsWithProfiles);
      setUserProfiles(profiles || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: "Error",
        description: "Failed to load events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setUserProfiles(data || []);
    } catch (error) {
      console.error('Error fetching user profiles:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchUserProfiles();
  }, [currentDate]);

  // Navigate to the previous/next week
  const goToPreviousWeek = () => {
    setCurrentDate(addDays(currentDate, -7));
  };

  const goToNextWeek = () => {
    setCurrentDate(addDays(currentDate, 7));
  };

  const handleAddEvent = (date?: Date) => {
    setSelectedEvent(null);
    setEventFormOpen(true);
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleEditEvent = (event: Event) => {
    // Convert string dates to Date objects for the EventForm
    const formattedEvent: EventType = {
      id: event.id,
      title: event.title,
      description: event.description,
      start_time: new Date(event.start_time),
      end_time: new Date(event.end_time),
      type: event.type,
      is_recurring: event.is_recurring,
      recurrence_pattern: event.recurrence_pattern,
      members: event.owner_ids || []
    };
    
    setSelectedEvent(formattedEvent);
    setEventFormOpen(true);
  };

  const confirmDeleteEvent = (event: Event) => {
    // Create an EventType from Event for consistency
    const eventToDelete: EventType = {
      id: event.id,
      title: event.title,
      description: event.description,
      start_time: new Date(event.start_time),
      end_time: new Date(event.end_time),
      type: event.type,
      is_recurring: event.is_recurring,
      recurrence_pattern: event.recurrence_pattern,
      members: event.owner_ids || []
    };
    
    setSelectedEvent(eventToDelete);
    setDeleteDialogOpen(true);
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !selectedEvent.id) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', selectedEvent.id);
        
      if (error) throw error;
      
      setEvents(events.filter(e => e.id !== selectedEvent.id));
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
      setDeleteDialogOpen(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    currentDate,
    weekDays,
    events,
    userProfiles,
    loading,
    selectedEvent,
    selectedDate,
    eventFormOpen,
    deleteDialogOpen,
    goToPreviousWeek,
    goToNextWeek,
    handleAddEvent,
    handleEditEvent,
    confirmDeleteEvent,
    handleDeleteEvent,
    fetchEvents,
    setEventFormOpen,
    setDeleteDialogOpen
  };
};
