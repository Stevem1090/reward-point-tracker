import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StarRating } from './StarRating';
import { Meal, MealRating } from '@/types/meal';
import { cn } from '@/lib/utils';

interface HistoryMealItemProps {
  meal: Meal;
  rating: MealRating | null;
  onRate: (rating: number, notes?: string) => void;
  isRating?: boolean;
}

const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

export function HistoryMealItem({ meal, rating, onRate, isRating }: HistoryMealItemProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(rating?.notes || '');
  const [pendingRating, setPendingRating] = useState<number | null>(null);

  const handleRatingChange = (newRating: number) => {
    if (newRating === 0) {
      // Clear rating - just save with 0
      onRate(0);
      return;
    }
    
    setPendingRating(newRating);
    // If no existing notes, expand to allow adding
    if (!rating?.notes) {
      setShowNotes(true);
    }
    // Auto-save after short delay if no notes interaction
    setTimeout(() => {
      if (!showNotes) {
        onRate(newRating, notes || undefined);
        setPendingRating(null);
      }
    }, 500);
  };

  const handleSaveNotes = () => {
    const ratingToSave = pendingRating ?? rating?.rating ?? 0;
    if (ratingToSave > 0) {
      onRate(ratingToSave, notes || undefined);
    }
    setPendingRating(null);
    setShowNotes(false);
  };

  const displayRating = pendingRating ?? rating?.rating ?? null;

  return (
    <div className="border-b last:border-b-0 py-3">
      <div className="flex flex-col gap-2">
        {/* Top row: day badge + meal info */}
        <div className="flex items-start gap-3">
          <Badge 
            variant="outline" 
            className="shrink-0 w-10 justify-center text-xs font-medium"
          >
            {DAY_ABBR[meal.day_of_week] || meal.day_of_week.slice(0, 3)}
          </Badge>

          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "font-medium text-sm truncate",
              !meal.meal_name && "text-muted-foreground italic"
            )}>
              {meal.meal_name || 'No meal planned'}
            </h4>
            {meal.estimated_cook_minutes && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Clock className="h-3 w-3" />
                <span>{meal.estimated_cook_minutes} mins</span>
              </div>
            )}
          </div>
        </div>

        {/* Rating row: aligned right */}
        {meal.meal_name ? (
          <div className="flex justify-end">
            <StarRating
              rating={displayRating}
              onRatingChange={handleRatingChange}
              size="sm"
            />
          </div>
        ) : (
          <div className="flex justify-end">
            <span className="text-xs text-muted-foreground">-</span>
          </div>
        )}
      </div>

      {/* Notes section */}
      {meal.meal_name && (displayRating || rating?.notes) && (
        <div className="mt-2 ml-13 pl-0.5">
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showNotes ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Hide notes
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                {rating?.notes ? 'View notes' : 'Add notes'}
              </>
            )}
          </button>

          {showNotes && (
            <div className="mt-2 space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for AI (e.g., 'Too spicy', 'Kids loved it')"
                className="text-sm min-h-[60px] resize-none"
              />
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={isRating}
              >
                {isRating ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
