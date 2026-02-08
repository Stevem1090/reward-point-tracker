import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MealSlot } from './MealSlot';
import { MealWithRecipeCard, DayOfWeek } from '@/types/meal';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableMealSlotProps {
  meal: MealWithRecipeCard;
  day: DayOfWeek;
  isPlanFinalised: boolean;
  mealPlanId: string;
  isFrozen?: boolean;
  onToggleFrozen?: () => void;
}

export function SortableMealSlot({ meal, day, isPlanFinalised, mealPlanId, isFrozen, onToggleFrozen }: SortableMealSlotProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: meal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "relative",
        isDragging && "opacity-50 z-10"
      )}
    >
      {/* Drag handle overlay - positioned on the left side of the card */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 text-muted-foreground hover:text-foreground transition-colors touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      
      {/* Add left padding to the MealSlot to make room for the drag handle */}
      <div className="pl-8">
        <MealSlot
          day={day}
          meal={meal}
          isPlanFinalised={isPlanFinalised}
          mealPlanId={mealPlanId}
          isFrozen={isFrozen}
          onToggleFrozen={onToggleFrozen}
        />
      </div>
    </div>
  );
}
