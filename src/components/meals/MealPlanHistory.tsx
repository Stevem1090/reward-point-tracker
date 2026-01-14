import { useMealPlans } from '@/hooks/useMealPlans';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar, ChevronRight } from 'lucide-react';
import { formatWeekRange } from '@/utils/getWeekBounds';
import { MealPlan } from '@/types/meal';

export function MealPlanHistory() {
  const { usePreviousMealPlans } = useMealPlans();
  const { data: previousPlans, isLoading, error } = usePreviousMealPlans();

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

  if (!previousPlans || previousPlans.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <CardTitle className="text-xl">No previous plans</CardTitle>
          <CardDescription>
            Your meal plan history will appear here
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {previousPlans.map((plan) => (
        <HistoryCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

interface HistoryCardProps {
  plan: MealPlan;
}

function HistoryCard({ plan }: HistoryCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{formatWeekRange(plan.week_start_date)}</h3>
              <p className="text-sm text-muted-foreground">
                {plan.status === 'approved' ? 'Completed' : 'Draft'}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
