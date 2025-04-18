
import React from 'react';
import { CalendarDays, Plus, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EventForm } from "@/components/EventForm";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ProfileManager } from "@/components/ProfileManager";
import { WeeklyCalendarView } from '@/components/calendar/WeeklyCalendarView';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { DeleteEventDialog } from '@/components/calendar/DeleteEventDialog';
import { useCalendar } from '@/hooks/useCalendar';

const CalendarPage = () => {
  const { 
    weekDays, 
    events, 
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
  } = useCalendar();

  return (
    <div className="w-full overflow-x-hidden">
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 bg-gradient-to-r from-kid-blue via-kid-purple to-kid-green bg-clip-text text-transparent">
        Family Calendar
      </h1>
      <p className="text-center mb-4 text-muted-foreground">Keep track of all your family events!</p>
      
      {/* Week navigation */}
      <CalendarHeader 
        weekDays={weekDays}
        onPreviousWeek={goToPreviousWeek}
        onNextWeek={goToNextWeek}
      />
      
      <Card className="kid-card bg-white/80 backdrop-blur-sm shadow-md overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center text-kid-purple">
            <CalendarDays className="mr-2 h-5 w-5" />
            Week View
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <WeeklyCalendarView 
            weekDays={weekDays}
            events={events}
            loading={loading}
            onAddEvent={handleAddEvent}
            onEditEvent={handleEditEvent}
            onDeleteEvent={confirmDeleteEvent}
          />
        </CardContent>
      </Card>
      
      <div className="mt-4 flex justify-between px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              User Profiles
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Profile Settings</SheetTitle>
              <SheetDescription>
                Manage your user profiles here.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <ProfileManager />
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
      <DeleteEventDialog 
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteEvent}
        eventTitle={selectedEvent?.title || ''}
      />
    </div>
  );
};

export default CalendarPage;
