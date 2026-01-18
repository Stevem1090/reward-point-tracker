import { useState } from 'react';
import { useMealPlans } from '@/hooks/useMealPlans';
import { useMealRatings } from '@/hooks/useMealRatings';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Calendar, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { formatWeekRange, isThisWeek, isNextWeek, getWeekStartDate } from '@/utils/getWeekBounds';
import { MealPlan, Meal, MealRating, DAYS_OF_WEEK } from '@/types/meal';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HistoryMealItem } from './HistoryMealItem';
import { Badge } from '@/components/ui/badge';

export function MealPlanHistory() {
  const { useAllMealPlansWithMeals } = useMealPlans();
  const { data: allPlans, isLoading, error } = useAllMealPlansWithMeals();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8 text-center">
          <p className="text-destructive">Failed to load history</p>
        </CardContent>
      </Card>
    );
  }

  if (!allPlans || allPlans.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <h3 className="text-xl font-medium">No meal plans yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your meal plan history will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {allPlans.map((plan) => (
        <HistoryWeekCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

interface HistoryWeekCardProps {
  plan: MealPlan & { meals?: Meal[] };
}

function HistoryWeekCard({ plan }: HistoryWeekCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { useRatingsForMeals, upsertRating } = useMealRatings();
  
  const mealIds = plan.meals?.map(m => m.id) || [];
  const { data: ratings } = useRatingsForMeals(mealIds);

  // Build ratings map
  const ratingsMap = new Map<string, MealRating>();
  ratings?.forEach(r => ratingsMap.set(r.meal_id, r));

  // Calculate rating summary
  const ratedCount = ratings?.filter(r => r.rating > 0).length || 0;
  const totalMeals = plan.meals?.filter(m => m.meal_name).length || 0;

  const handleRate = (mealId: string, rating: number, notes?: string) => {
    upsertRating.mutate({ mealId, rating, notes });
  };

  const isCurrentWeek = isThisWeek(plan.week_start_date);
  const isUpcomingWeek = isNextWeek(plan.week_start_date);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardContent className="py-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{formatWeekRange(plan.week_start_date)}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isCurrentWeek && (
                      <Badge variant="default" className="text-xs">Current Week</Badge>
                    )}
                    {isUpcomingWeek && (
                      <Badge variant="secondary" className="text-xs">Next Week</Badge>
                    )}
                    {!isCurrentWeek && !isUpcomingWeek && (
                      <span className="text-sm text-muted-foreground">
                        {plan.status === 'approved' ? 'Completed' : 'Draft'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {totalMeals > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span>{ratedCount}/{totalMeals}</span>
                  </div>
                )}
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-4 pb-4">
            {plan.meals && plan.meals.length > 0 ? (
              [...plan.meals]
                .sort((a, b) => {
                  const aIndex = DAYS_OF_WEEK.indexOf(a.day_of_week);
                  const bIndex = DAYS_OF_WEEK.indexOf(b.day_of_week);
                  return aIndex - bIndex;
                })
                .map((meal) => (
                  <HistoryMealItem
                    key={meal.id}
                    meal={meal}
                    rating={ratingsMap.get(meal.id) || null}
                    onRate={(rating, notes) => handleRate(meal.id, rating, notes)}
                    isRating={upsertRating.isPending}
                  />
                ))
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No meals in this plan
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
