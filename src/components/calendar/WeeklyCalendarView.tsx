import React from 'react';
import { format, isSameDay } from 'date-fns';
import { Edit2, Trash2 } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";

// Time slots for the day view (from 6 AM to 9 PM)
const timeSlots = Array.from({ length: 16 }, (_, i) => i + 6);

type Member = {
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
  members: Member[];
};

interface WeeklyCalendarViewProps {
  weekDays: Date[];
  events: Event[];
  loading: boolean;
  onAddEvent: (date: Date) => void;
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (event: Event) => void;
}

export const WeeklyCalendarView: React.FC<WeeklyCalendarViewProps> = ({
  weekDays,
  events,
  loading,
  onAddEvent,
  onEditEvent,
  onDeleteEvent
}) => {
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

  const getEventPosition = (event: Event, day: Date) => {
    if (!isSameDay(new Date(event.start_time), day)) return null;
    
    const startHour = new Date(event.start_time).getHours();
    const startMinutes = new Date(event.start_time).getMinutes();
    const endHour = new Date(event.end_time).getHours();
    const endMinutes = new Date(event.end_time).getMinutes();
    
    const topPosition = (startHour - 6) * 60 + startMinutes;
    
    const duration = ((endHour - startHour) * 60 + (endMinutes - startMinutes));
    
    return {
      top: `${topPosition}px`,
      height: `${duration}px`,
      position: 'absolute' as const,
      width: 'calc(100% - 16px)',
      left: '8px'
    };
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

  if (loading) {
    return (
      <div className="flex h-[800px]">
        <div className="w-[80px] min-w-[80px] shrink-0 border-r bg-white">
          {timeSlots.map((hour) => (
            <div key={hour} className="h-[60px] border-b">
              <Skeleton className="h-4 w-10 m-2" />
            </div>
          ))}
        </div>
        <div className="flex flex-1">
          {Array(7).fill(0).map((_, i) => (
            <div key={i} className="w-[200px] shrink-0 relative">
              {timeSlots.map((hour) => (
                <div key={hour} className="h-[60px] border-b border-r">
                  <Skeleton className="h-10 w-full opacity-10" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[800px]">
      <div className="overflow-x-auto">
        <div className="w-fit min-w-[880px]">
          <div className="flex border-b sticky top-0 bg-white z-20">
            <div className="w-[80px] min-w-[80px] shrink-0 border-r px-2 font-semibold text-muted-foreground text-center py-2 flex flex-col justify-center sticky left-0 z-30 bg-white">
              Time
            </div>
            
            <div className="flex flex-1">
              {weekDays.map((day, index) => (
                <div 
                  key={index} 
                  className={`w-[200px] shrink-0 px-2 py-2 text-center font-semibold ${isSameDay(day, new Date()) ? 'bg-soft-purple text-kid-purple' : ''}`}
                >
                  <div>{format(day, 'EEE')}</div>
                  <div className="flex items-center justify-center gap-1">
                    <span>{format(day, 'd')}</span>
                    <button 
                      className="h-5 w-5 rounded-full hover:bg-gray-100 flex items-center justify-center"
                      onClick={() => onAddEvent(day)}
                    >
                      <span className="text-xs">+</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex">
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

            <div className="flex flex-1">
              {weekDays.map((day, dayIndex) => (
                <div key={dayIndex} className="w-[200px] shrink-0 relative">
                  {timeSlots.map((hour) => (
                    <div 
                      key={hour} 
                      className="h-[60px] border-b border-r last:border-r-0 px-1"
                    />
                  ))}
                  
                  {events.map((event) => {
                    const position = getEventPosition(event, day);
                    if (!position) return null;
                    
                    return (
                      <div 
                        key={event.id}
                        className={`group rounded-md p-1 text-xs shadow-sm hover:shadow-md transition-shadow cursor-pointer ${getEventBadgeColor(event.type)}`}
                        style={position}
                        onClick={() => onEditEvent(event)}
                      >
                        <div className="font-bold truncate flex justify-between items-start">
                          <span className="truncate">{event.title}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              className="text-white hover:text-gray-200 p-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditEvent(event);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button 
                              className="text-white hover:text-gray-200 p-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteEvent(event);
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
  );
};
