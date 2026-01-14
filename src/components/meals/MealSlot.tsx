import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MealWithRecipeCard, DayOfWeek } from '@/types/meal';
import { Clock, Users, Check, X, MoreVertical, Plus } from 'lucide-react';
import { useMealPlans } from '@/hooks/useMealPlans';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MealSlotProps {
  day: DayOfWeek;
  meal?: MealWithRecipeCard;
  isPlanFinalised: boolean;
}

export function MealSlot({ day, meal, isPlanFinalised }: MealSlotProps) {
  const { updateMealStatus } = useMealPlans();

  const isWeekend = day === 'Saturday' || day === 'Sunday';

  const handleApprove = () => {
    if (meal) {
      updateMealStatus.mutate({ mealId: meal.id, status: 'approved' });
    }
  };

  const handleReject = () => {
    if (meal) {
      updateMealStatus.mutate({ mealId: meal.id, status: 'rejected' });
    }
  };

  // Empty slot
  if (!meal) {
    return (
      <Card className="border-dashed opacity-60">
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center text-xs font-medium",
              isWeekend ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
            )}>
              {day.slice(0, 3)}
            </div>
            <span className="text-muted-foreground">No meal planned</span>
          </div>
          {!isPlanFinalised && (
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <Card className={cn(
      "transition-all",
      meal.status === 'rejected' && "opacity-60"
    )}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          {/* Day indicator */}
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center text-xs font-medium shrink-0",
            isWeekend ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"
          )}>
            {day.slice(0, 3)}
          </div>

          {/* Meal info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium text-base truncate">{meal.meal_name}</h3>
                {meal.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                    {meal.description}
                  </p>
                )}
              </div>
              
              {/* Status badge - only show when not finalised */}
              {!isPlanFinalised && (
                <Badge 
                  variant="outline" 
                  className={cn("shrink-0 text-xs", statusColors[meal.status])}
                >
                  {meal.status}
                </Badge>
              )}
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {meal.estimated_cook_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {meal.estimated_cook_minutes} mins
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {meal.servings} servings
              </span>
            </div>
          </div>

          {/* Actions */}
          {!isPlanFinalised && meal.status === 'pending' && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={handleApprove}
                disabled={updateMealStatus.isPending}
              >
                <Check className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleReject}
                disabled={updateMealStatus.isPending}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}

          {/* More options menu */}
          {!isPlanFinalised && meal.status !== 'pending' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {meal.status === 'rejected' && (
                  <DropdownMenuItem onClick={handleApprove}>
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </DropdownMenuItem>
                )}
                {meal.status === 'approved' && (
                  <DropdownMenuItem onClick={handleReject}>
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <Users className="h-4 w-4 mr-2" />
                  Change Servings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
