
import React, { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO, addHours } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

// Time slots for the day view (from 6 AM to 9 PM)
const timeSlots = Array.from({ length: 16 }, (_, i) => i + 6);

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  
  // Sample events - in a real app, these would come from a database
  const events = [
    { id: 1, title: "School Play", startTime: new Date(2025, 3, 15, 14, 0), endTime: new Date(2025, 3, 15, 16, 0), type: "school" },
    { id: 2, title: "Dentist Appointment", startTime: new Date(2025, 3, 17, 10, 30), endTime: new Date(2025, 3, 17, 11, 30), type: "appointment" },
    { id: 3, title: "Soccer Practice", startTime: new Date(2025, 3, 18, 16, 0), endTime: new Date(2025, 3, 18, 17, 30), type: "sport" },
    { id: 4, title: "Family Dinner", startTime: new Date(2025, 3, 20, 18, 0), endTime: new Date(2025, 3, 20, 19, 30), type: "family" },
    { id: 5, title: "Piano Lesson", startTime: new Date(2025, 3, 16, 15, 0), endTime: new Date(2025, 3, 16, 16, 0), type: "lesson" },
    // Adding events for the current week to ensure we see something
    { id: 6, title: "Team Meeting", startTime: addHours(new Date(), 2), endTime: addHours(new Date(), 3), type: "work" },
    { id: 7, title: "Gym Session", startTime: addHours(addDays(new Date(), 1), 18), endTime: addHours(addDays(new Date(), 1), 19), type: "sport" },
    { id: 8, title: "Doctor Visit", startTime: addHours(addDays(new Date(), 2), 9), endTime: addHours(addDays(new Date(), 2), 10), type: "appointment" },
    { id: 9, title: "Movie Night", startTime: addHours(addDays(new Date(), 3), 19), endTime: addHours(addDays(new Date(), 3), 21), type: "family" },
  ];

  // Generate an array of dates for the current week
  const getWeekDays = (date: Date) => {
    const start = startOfWeek(date, { weekStartsOn: 1 }); // Start from Monday
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const weekDays = getWeekDays(currentDate);

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
  const getEventPosition = (event: any, day: Date) => {
    if (!isSameDay(event.startTime, day)) return null;
    
    const startHour = event.startTime.getHours();
    const startMinutes = event.startTime.getMinutes();
    const endHour = event.endTime.getHours();
    const endMinutes = event.endTime.getMinutes();
    
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

  return (
    <div className="container mx-auto max-w-full px-0 md:px-4">
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 bg-gradient-to-r from-kid-blue via-kid-purple to-kid-green bg-clip-text text-transparent">
        Family Calendar
      </h1>
      <p className="text-center mb-4 text-muted-foreground">Keep track of all your family events!</p>
      
      {/* Week navigation */}
      <div className="flex justify-between items-center mb-4 px-4">
        <Button variant="outline" onClick={goToPreviousWeek}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous Week
        </Button>
        <h2 className="text-xl font-semibold">
          {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
        </h2>
        <Button variant="outline" onClick={goToNextWeek}>
          Next Week
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
          {/* Fixed container for calendar with proper overflow handling */}
          <div className="overflow-hidden">
            {/* Day headers - now wider with overflow scroll */}
            <div className="flex border-b sticky top-0 bg-white z-20">
              <div className="w-[80px] min-w-[80px] shrink-0 border-r px-2 font-semibold text-muted-foreground text-center py-2 flex flex-col justify-center sticky left-0 z-20 bg-white">
                Time
              </div>
              <div className="flex">
                {weekDays.map((day, index) => (
                  <div 
                    key={index} 
                    className={`min-w-[200px] w-[200px] shrink-0 px-2 py-2 text-center font-semibold ${isSameDay(day, new Date()) ? 'bg-soft-purple text-kid-purple' : ''}`}
                  >
                    <div>{format(day, 'EEE')}</div>
                    <div>{format(day, 'd')}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calendar body with horizontal scrolling and fixed height */}
            <div className="relative overflow-x-auto" style={{ height: '800px' }}>
              <div className="flex">
                {/* Time slots - sticky left column */}
                <div className="w-[80px] min-w-[80px] shrink-0 border-r sticky left-0 bg-white z-10">
                  {timeSlots.map((hour) => (
                    <div 
                      key={hour} 
                      className="h-[60px] border-b px-2 text-sm text-muted-foreground flex items-start pt-1"
                    >
                      {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                    </div>
                  ))}
                </div>

                {/* Days columns with overflow */}
                <div className="flex">
                  {weekDays.map((day, dayIndex) => (
                    <div key={dayIndex} className="min-w-[200px] w-[200px] shrink-0 relative">
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
                            className={`rounded-md p-1 text-xs shadow-sm hover:shadow-md transition-shadow cursor-pointer ${getEventBadgeColor(event.type)}`}
                            style={position}
                          >
                            <div className="font-bold truncate">{event.title}</div>
                            <div className="text-xs opacity-90">
                              {format(event.startTime, 'h:mm a')} - {format(event.endTime, 'h:mm a')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-4 flex justify-end px-4">
        <Button className="bg-kid-purple hover:bg-purple-600">
          Add Event
        </Button>
      </div>
    </div>
  );
};

export default CalendarPage;
