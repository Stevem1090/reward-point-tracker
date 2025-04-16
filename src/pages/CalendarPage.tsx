import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO, addHours } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, ChevronRight, CalendarDays, Plus, Edit2, Trash2, Settings 
} from 'lucide-react';
import { EventForm } from "@/components/EventForm";
import { FamilyMemberManager } from "@/components/FamilyMemberManager";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Time slots for the day view (from 6 AM to 9 PM)
const timeSlots = Array.from({ length: 16 }, (_, i) => i + 6);

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

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const { toast } = useToast();
  
  // Generate an array of dates for the current week
  const getWeekDays = (date: Date) => {
    const start = startOfWeek(date, { weekStartsOn: 1 }); // Start from Monday
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const weekDays = getWeekDays(currentDate);

  useEffect(() => {
    fetchEvents();
    fetchFamilyMembers();
  }, [currentDate]);

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

  // Navigate to the previous/next week
  const goToPreviousWeek = () => {
    setCurrentDate(addDays(currentDate, -7));
  };

  const goToNextWeek = () => {
    setCurrentDate(addDays(currentDate, 7));
  };

  const getEventBadgeColor = (type: string) => {
    switch(type) {
      case "school": return "bg-kid-blue text-white";
      case "appointment": return "bg-kid-purple text-white";
      case "sport": return "bg-kid-green text-white";
      case "family": return "bg-kid-orange text-white";
      case "lesson": return "bg-kid-yellow text-black";
      case "work": return "bg-blue-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  // Function to position events in the grid based on their time
  const getEventPosition = (event: Event, day: Date) => {
    if (!isSameDay(new Date(event.start_time), day)) return null;
    
    const startHour = new Date(event.start_time).getHours();
    const startMinutes = new Date(event.start_time).getMinutes();
    const endHour = new Date(event.end_time).getHours();
    const endMinutes = new Date(event.end_time).getMinutes();
    
    // Calculate top position based on start time (relative to 6 AM)
    const topPosition = (startHour - 6) * 60 + startMinutes;
    
    // Calculate height based on duration
    const duration = ((endHour - startHour) * 60 + (endMinutes - startMinutes));
    
    return {
      top: `${topPosition}px`,
      height: `${duration}px`,
      position: 'absolute' as const,
      width: 'calc(100% - 16px)',
      left: '8px'
    };
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

  const renderEventMembers = (event: Event) => {
    if (!event.members || event.members.length === 0) return null;
    
    return (
      <div className="flex mt-1 flex-wrap gap-1">
        {event.members.map(member => (
          <div 
            key={member.id} 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: member.color }}
            title={member.name}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="w-full overflow-x-hidden">
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 bg-gradient-to-r from-kid-blue via-kid-purple to-kid-green bg-clip-text text-transparent">
        Family Calendar
      </h1>
      <p className="text-center mb-4 text-muted-foreground">Keep track of all your family events!</p>
      
      {/* Week navigation */}
      <div className="flex justify-between items-center mb-4 px-4">
        <Button variant="outline" onClick={goToPreviousWeek}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <h2 className="text-xl font-semibold">
          {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d')}
        </h2>
        <Button variant="outline" onClick={goToNextWeek}>
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
      
      <Card className="kid-card bg-white/80 backdrop-blur-sm shadow-md overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center text-kid-purple">
            <CalendarDays className="mr-2 h-5 w-5" />
            Week View
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col h-[800px]">
            <div className="overflow-x-auto">
              <div className="w-fit min-w-[880px]">
                {/* Day headers - sticky at the top */}
                <div className="flex border-b sticky top-0 bg-white z-20">
                  {/* Time column header - empty space for alignment */}
                  <div className="w-[80px] min-w-[80px] shrink-0 border-r px-2 font-semibold text-muted-foreground text-center py-2 flex flex-col justify-center sticky left-0 z-30 bg-white">
                    Time
                  </div>
                  
                  {/* Day headers container */}
                  <div className="flex flex-1">
                    {weekDays.map((day, index) => (
                      <div 
                        key={index} 
                        className={`w-[200px] shrink-0 px-2 py-2 text-center font-semibold ${isSameDay(day, new Date()) ? 'bg-soft-purple text-kid-purple' : ''}`}
                      >
                        <div>{format(day, 'EEE')}</div>
                        <div className="flex items-center justify-center gap-1">
                          <span>{format(day, 'd')}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 rounded-full"
                            onClick={() => handleAddEvent(day)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calendar body */}
                <div className="flex">
                  {/* Time slots - sticky left column */}
                  <div className="w-[80px] min-w-[80px] shrink-0 border-r sticky left-0 bg-white z-20 h-full">
                    {timeSlots.map((hour) => (
                      <div 
                        key={hour} 
                        className="h-[60px] border-b px-2 text-sm text-muted-foreground flex items-start pt-1"
                      >
                        {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid with events */}
                  <div className="flex flex-1">
                    {weekDays.map((day, dayIndex) => (
                      <div key={dayIndex} className="w-[200px] shrink-0 relative">
                        {/* Time grid for this day */}
                        {timeSlots.map((hour) => (
                          <div 
                            key={hour} 
                            className="h-[60px] border-b border-r last:border-r-0 px-1"
                          />
                        ))}
                        
                        {/* Events for this day */}
                        {events.map((event) => {
                          const position = getEventPosition(event, day);
                          if (!position) return null;
                          
                          return (
                            <div 
                              key={event.id}
                              className={`group rounded-md p-1 text-xs shadow-sm hover:shadow-md transition-shadow cursor-pointer ${getEventBadgeColor(event.type)}`}
                              style={position}
                              onClick={() => handleEditEvent(event)}
                            >
                              <div className="font-bold truncate flex justify-between items-start">
                                <span className="truncate">{event.title}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    className="text-white hover:text-gray-200 p-0.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditEvent(event);
                                    }}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                  <button 
                                    className="text-white hover:text-gray-200 p-0.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      confirmDeleteEvent(event);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="text-xs opacity-90">
                                {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                              </div>
                              {renderEventMembers(event)}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-4 flex justify-between px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Family Members
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Family Settings</SheetTitle>
              <SheetDescription>
                Manage your family members here.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <FamilyMemberManager />
            </div>
          </SheetContent>
        </Sheet>
        
        <Button className="bg-kid-purple hover:bg-purple-600" onClick={() => handleAddEvent()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>
      
      {/* Event Form Dialog */}
      <EventForm 
        isOpen={eventFormOpen}
        onClose={() => setEventFormOpen(false)}
        initialDate={selectedDate || new Date()}
        editEvent={selectedEvent}
        onSave={fetchEvents}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the event "{selectedEvent?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CalendarPage;
