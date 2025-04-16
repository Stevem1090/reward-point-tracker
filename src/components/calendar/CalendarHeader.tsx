
import React from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface CalendarHeaderProps {
  weekDays: Date[];
  onPreviousWeek: () => void;
  onNextWeek: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  weekDays,
  onPreviousWeek,
  onNextWeek
}) => {
  return (
    <div className="flex justify-between items-center mb-4 px-4 overflow-hidden-x">
      <Button variant="outline" onClick={onPreviousWeek}>
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous
      </Button>
      <h2 className="text-xl font-semibold">
        {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d')}
      </h2>
      <Button variant="outline" onClick={onNextWeek}>
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
};
