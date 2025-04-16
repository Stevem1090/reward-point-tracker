
import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type FamilyMember = {
  id: string;
  name: string;
  color: string;
};

type Event = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  type: string;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  members: FamilyMember[];
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
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
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
      
      // Get the week's start and end dates for the query
      const weekStart = weekDays[0];
      const weekEnd = addDays(weekDays[6], 1); // Add 1 day to include the entire last day
      
      // Fetch events for the current week
      let { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .or(`start_time.gte.${weekStart.toISOString()},end_time.lte.${weekEnd.toISOString()}`)
        .order('start_time');
        
      if (eventsError) throw eventsError;
      
      // Fetch family members for each event
      const eventsWithMembers = await Promise.all((eventsData || []).map(async (event) => {
        // Get members for this event
        const { data: memberJoins, error: memberError } = await supabase
          .from('event_members')
          .select('family_member_id')
          .eq('event_id', event.id);
          
        if (memberError) throw memberError;
        
        if (!memberJoins || memberJoins.length === 0) {
          return { ...event, members: [] };
        }
        
        // Get the details of each family member
        const memberIds = memberJoins.map(join => join.family_member_id);
        const { data: members, error: membersError } = await supabase
          .from('family_members')
          .select('*')
          .in('id', memberIds);
          
        if (membersError) throw membersError;
        
        return { ...event, members: members || [] };
      }));
      
      setEvents(eventsWithMembers);
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

  const fetchFamilyMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setFamilyMembers(data || []);
    } catch (error) {
      console.error('Error fetching family members:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchFamilyMembers();
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
      members: event.members.map(member => member.id)
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
      members: event.members.map(member => member.id)
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
    familyMembers,
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
