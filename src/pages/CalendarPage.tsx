
import React from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, CalendarDays } from 'lucide-react';

const CalendarPage = () => {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  
  // Sample events - in a real app, these would come from a database
  const events = [
    { id: 1, title: "School Play", date: new Date(2025, 3, 15), type: "school" },
    { id: 2, title: "Dentist Appointment", date: new Date(2025, 3, 17), type: "appointment" },
    { id: 3, title: "Soccer Practice", date: new Date(2025, 3, 18), type: "sport" },
    { id: 4, title: "Family Dinner", date: new Date(2025, 3, 20), type: "family" },
  ];
  
  // Filter events for the selected date
  const selectedDateEvents = date 
    ? events.filter(event => 
        event.date.getDate() === date.getDate() && 
        event.date.getMonth() === date.getMonth() && 
        event.date.getFullYear() === date.getFullYear()
      )
    : [];

  const getEventBadgeColor = (type: string) => {
    switch(type) {
      case "school": return "bg-kid-blue text-white";
      case "appointment": return "bg-kid-purple text-white";
      case "sport": return "bg-kid-green text-white";
      case "family": return "bg-kid-orange text-white";
      default: return "bg-kid-yellow text-black";
    }
  };
  
  return (
    <div className="container mx-auto max-w-5xl">
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 bg-gradient-to-r from-kid-blue via-kid-purple to-kid-green bg-clip-text text-transparent">
        Family Calendar
      </h1>
      <p className="text-center mb-8 text-muted-foreground">Keep track of all your family events!</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="kid-card bg-white/80 backdrop-blur-sm shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-kid-purple">
                <CalendarDays className="mr-2 h-5 w-5" />
                Calendar
              </CardTitle>
              <CardDescription>Select a date to view events</CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card className="kid-card bg-white/80 backdrop-blur-sm h-full shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-kid-purple">
                <CalendarClock className="mr-2 h-5 w-5" />
                Events for {date?.toLocaleDateString()}
              </CardTitle>
              <CardDescription>
                {selectedDateEvents.length 
                  ? `${selectedDateEvents.length} events scheduled` 
                  : "No events for this date"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDateEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateEvents.map(event => (
                    <div key={event.id} className="p-3 rounded-lg bg-white shadow-sm border hover:shadow-md transition-all">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">{event.title}</h3>
                        <Badge className={getEventBadgeColor(event.type)}>
                          {event.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {event.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <p>No events scheduled for this day.</p>
                  <p className="mt-2 text-sm">Click the + button to add a new event!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
