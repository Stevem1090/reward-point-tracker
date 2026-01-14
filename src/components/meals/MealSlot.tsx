import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MealWithRecipeCard, DayOfWeek } from '@/types/meal';
import { Clock, Users, Check, X, MoreVertical, Plus, ExternalLink, Pencil, RefreshCw } from 'lucide-react';
import { useMealPlans } from '@/hooks/useMealPlans';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SwapMealDialog } from './SwapMealDialog';

interface MealSlotProps {
  day: DayOfWeek;
  meal?: MealWithRecipeCard;
  isPlanFinalised: boolean;
  mealPlanId?: string;
}

export function MealSlot({ day, meal, isPlanFinalised, mealPlanId }: MealSlotProps) {
  const { updateMealStatus, updateMealUrl, replaceMeal, addMealToDay } = useMealPlans();
  const [isEditUrlOpen, setIsEditUrlOpen] = useState(false);
  const [editedUrl, setEditedUrl] = useState('');
  const [isSwapDialogOpen, setIsSwapDialogOpen] = useState(false);

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

  const handleEditUrl = () => {
    setEditedUrl(meal?.recipe_url || '');
    setIsEditUrlOpen(true);
  };

  const handleSaveUrl = () => {
    if (meal) {
      updateMealUrl.mutate({ mealId: meal.id, recipeUrl: editedUrl });
      setIsEditUrlOpen(false);
    }
  };

  const handleSwapMeal = async (data: {
    mealName: string;
    description?: string;
    recipeUrl?: string;
    servings: number;
    estimatedCookMinutes?: number;
    recipeId?: string;
  }) => {
    if (meal) {
      await replaceMeal.mutateAsync({
        mealId: meal.id,
        ...data,
      });
    } else if (mealPlanId) {
      await addMealToDay.mutateAsync({
        mealPlanId,
        dayOfWeek: day,
        ...data,
      });
    }
    setIsSwapDialogOpen(false);
  };

  // Extract domain from URL for display
  const getUrlDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain;
    } catch {
      return url;
    }
  };

  // Empty slot
  if (!meal) {
    return (
      <>
        <Card className="border-dashed opacity-60">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center text-xs font-medium shrink-0",
                isWeekend ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
              )}>
                {day.slice(0, 3)}
              </div>
              <span className="text-muted-foreground">No meal planned</span>
            </div>
            {!isPlanFinalised && mealPlanId && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10"
                onClick={() => setIsSwapDialogOpen(true)}
              >
                <Plus className="h-5 w-5" />
              </Button>
            )}
          </CardContent>
        </Card>
        
        <SwapMealDialog
          open={isSwapDialogOpen}
          onOpenChange={setIsSwapDialogOpen}
          day={day}
          onSwap={handleSwapMeal}
          isSwapping={addMealToDay.isPending}
        />
      </>
    );
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <>
      <Card className={cn(
        "transition-all",
        meal.status === 'rejected' && "opacity-60"
      )}>
        <CardContent className="py-4">
          {/* Mobile-first stacked layout */}
          <div className="flex flex-col gap-3">
            {/* Top row: Day + Meal name + Status badge (on larger screens) */}
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
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-base leading-snug">{meal.meal_name}</h3>
                    {meal.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {meal.description}
                      </p>
                    )}
                  </div>
                  
                  {/* Status badge - hidden on mobile when pending (buttons will show below) */}
                  {!isPlanFinalised && (
                    <div className="hidden sm:block">
                      <Badge 
                        variant="outline" 
                        className={cn("shrink-0 text-xs", statusColors[meal.status])}
                      >
                        {meal.status}
                      </Badge>
                    </div>
                  )}

                  {/* Desktop actions - hidden on mobile */}
                  {!isPlanFinalised && meal.status === 'pending' && (
                    <div className="hidden sm:flex items-center gap-1 shrink-0">
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

                  {/* More options menu - desktop only */}
                  {!isPlanFinalised && meal.status !== 'pending' && (
                    <div className="hidden sm:block">
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
                          <DropdownMenuItem onClick={handleEditUrl}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Recipe URL
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsSwapDialogOpen(true)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Replace Meal
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
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

                {/* Recipe URL */}
                {meal.recipe_url && (
                  <div className="flex items-center gap-2 mt-2">
                    <a
                      href={meal.recipe_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1.5 truncate"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{getUrlDomain(meal.recipe_url)}</span>
                    </a>
                    {!isPlanFinalised && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={handleEditUrl}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile action buttons - full width, stacked below content */}
            {!isPlanFinalised && meal.status === 'pending' && (
              <div className="flex sm:hidden gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 min-h-[44px] text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                  onClick={handleApprove}
                  disabled={updateMealStatus.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 min-h-[44px] text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={handleReject}
                  disabled={updateMealStatus.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            )}

            {/* Mobile status + actions for non-pending */}
            {!isPlanFinalised && meal.status !== 'pending' && (
              <div className="flex sm:hidden items-center justify-between gap-2 pt-1">
                <Badge 
                  variant="outline" 
                  className={cn("text-xs", statusColors[meal.status])}
                >
                  {meal.status}
                </Badge>
                <div className="flex gap-2">
                  {meal.status === 'rejected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] text-green-600 border-green-200"
                      onClick={handleApprove}
                      disabled={updateMealStatus.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  )}
                  {meal.status === 'approved' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] text-red-600 border-red-200"
                      onClick={handleReject}
                      disabled={updateMealStatus.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Edit URL Dialog */}
      <Dialog open={isEditUrlOpen} onOpenChange={setIsEditUrlOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Recipe URL</DialogTitle>
          </DialogHeader>
          <Input
            value={editedUrl}
            onChange={(e) => setEditedUrl(e.target.value)}
            placeholder="https://..."
            type="url"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUrlOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUrl} disabled={updateMealUrl.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap Meal Dialog */}
      <SwapMealDialog
        open={isSwapDialogOpen}
        onOpenChange={setIsSwapDialogOpen}
        day={day}
        mealId={meal.id}
        onSwap={handleSwapMeal}
        isSwapping={replaceMeal.isPending}
      />
    </>
  );
}
