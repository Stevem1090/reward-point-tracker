import { useMealPlans } from '@/hooks/useMealPlans';
import { MealSlot } from './MealSlot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, Check } from 'lucide-react';
import { DAYS_OF_WEEK, MealWithRecipeCard } from '@/types/meal';
import { useState } from 'react';
import { toast } from 'sonner';

interface MealPlanViewProps {
  weekStartDate: string;
}

export function MealPlanView({ weekStartDate }: MealPlanViewProps) {
  const { useMealPlanForWeek, createMealPlan, approveMealPlan } = useMealPlans();
  const { data: mealPlan, isLoading, error } = useMealPlanForWeek(weekStartDate);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      // First create the meal plan if it doesn't exist
      if (!mealPlan) {
        await createMealPlan.mutateAsync(weekStartDate);
      }
      // TODO: Call generate-meal-plan edge function
      toast.info('AI meal generation coming soon!');
    } catch (error) {
      console.error('Failed to generate plan:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalisePlan = async () => {
    if (!mealPlan) return;
    try {
      await approveMealPlan.mutateAsync(mealPlan.id);
    } catch (error) {
      console.error('Failed to approve plan:', error);
    }
  };

  // Get meal for a specific day
  const getMealForDay = (day: string): MealWithRecipeCard | undefined => {
    return mealPlan?.meals.find(m => m.day_of_week === day);
  };

  // Check if all meals are approved
  const allMealsApproved = mealPlan?.meals.length === 7 && 
    mealPlan.meals.every(m => m.status === 'approved');

  // Check if plan is already finalised
  const isPlanFinalised = mealPlan?.status === 'approved';

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
          <p className="text-destructive">Failed to load meal plan</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty state - no plan exists
  if (!mealPlan || mealPlan.meals.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">No meal plan yet</CardTitle>
          <CardDescription>
            Generate an AI-powered meal plan for your family
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
          <Button 
            size="lg" 
            onClick={handleGeneratePlan}
            disabled={isGenerating || createMealPlan.isPending}
            className="min-h-[48px] gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Meal Plan
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status banner for approved plans */}
      {isPlanFinalised && (
        <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <CardContent className="py-3 flex items-center justify-center gap-2 text-green-700 dark:text-green-300">
            <Check className="h-5 w-5" />
            <span className="font-medium">Meal plan approved! Check the Shopping tab for your list.</span>
          </CardContent>
        </Card>
      )}

      {/* Meal slots for each day */}
      <div className="space-y-3">
        {DAYS_OF_WEEK.map((day) => (
          <MealSlot
            key={day}
            day={day}
            meal={getMealForDay(day)}
            isPlanFinalised={isPlanFinalised}
          />
        ))}
      </div>

      {/* Finalise button */}
      {!isPlanFinalised && allMealsApproved && (
        <div className="pt-4 flex justify-center">
          <Button 
            size="lg" 
            onClick={handleFinalisePlan}
            disabled={approveMealPlan.isPending}
            className="min-h-[48px] gap-2"
          >
            {approveMealPlan.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Finalising...
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                Finalise Meal Plan
              </>
            )}
          </Button>
        </div>
      )}

      {/* Regenerate button for draft plans */}
      {!isPlanFinalised && mealPlan.meals.length > 0 && (
        <div className="pt-2 flex justify-center">
          <Button 
            variant="outline"
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Regenerate Plan
          </Button>
        </div>
      )}
    </div>
  );
}
