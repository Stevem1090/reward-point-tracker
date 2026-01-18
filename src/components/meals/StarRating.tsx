import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number | null;
  onRatingChange?: (rating: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md';
}

export function StarRating({ 
  rating, 
  onRatingChange, 
  readOnly = false, 
  size = 'md' 
}: StarRatingProps) {
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const touchSize = size === 'sm' ? 'min-w-[32px] min-h-[32px]' : 'min-w-[44px] min-h-[44px]';

  const handleClick = (starValue: number) => {
    if (!readOnly && onRatingChange) {
      // Toggle off if clicking same rating
      onRatingChange(rating === starValue ? 0 : starValue);
    }
  };

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = rating !== null && star <= rating;
        
        return (
          <button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            disabled={readOnly}
            className={cn(
              'flex items-center justify-center transition-colors',
              touchSize,
              readOnly 
                ? 'cursor-default' 
                : 'cursor-pointer hover:scale-110 active:scale-95'
            )}
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              className={cn(
                iconSize,
                'transition-colors',
                isFilled 
                  ? 'fill-amber-400 text-amber-400' 
                  : 'text-muted-foreground/40'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
