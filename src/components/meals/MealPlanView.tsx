import { useMealPlans } from '@/hooks/useMealPlans';
import { useAIMealGeneration } from '@/hooks/useAIMealGeneration';
import { useShoppingListGeneration } from '@/hooks/useShoppingListGeneration';
import { MealSlot } from './MealSlot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, Check, RefreshCw } from 'lucide-react';
import { DAYS_OF_WEEK, MealWithRecipeCard, DayOfWeek, Ingredient } from '@/types/meal';
import { toast } from 'sonner';

interface MealPlanViewProps {
  weekStartDate: string;
}

export function MealPlanView({ weekStartDate }: MealPlanViewProps) {
  const { useMealPlanForWeek, createMealPlan, approveMealPlan } = useMealPlans();
  const { data: mealPlan, isLoading, error } = useMealPlanForWeek(weekStartDate);
  const { generateMealPlan } = useAIMealGeneration();
  const { generateShoppingList } = useShoppingListGeneration();

  const isGenerating = generateMealPlan.isPending;
  const isFinalising = approveMealPlan.isPending || generateShoppingList.isPending;

  const handleGeneratePlan = async () => {
    try {
      let planId = mealPlan?.id;
      
      // First create the meal plan if it doesn't exist
      if (!planId) {
        const newPlan = await createMealPlan.mutateAsync(weekStartDate);
        planId = newPlan.id;
      }
      
      // Call AI to generate meals
      await generateMealPlan.mutateAsync({
        mealPlanId: planId,
        weekStartDate,
      });
    } catch (error) {
      console.error('Failed to generate plan:', error);
    }
  };

  const handleRegenerateRejected = async () => {
    if (!mealPlan) return;
    
    const rejectedDays = mealPlan.meals
      .filter(m => m.status === 'rejected')
      .map(m => m.day_of_week);
    
    if (rejectedDays.length === 0) {
      toast.info('No rejected meals to regenerate');
      return;
    }

    try {
      await generateMealPlan.mutateAsync({
        mealPlanId: mealPlan.id,
        weekStartDate,
        daysToRegenerate: rejectedDays,
      });
    } catch (error) {
      console.error('Failed to regenerate rejected meals:', error);
    }
  };

  const handleFinalisePlan = async () => {
    if (!mealPlan) return;
    try {
      // First approve the meal plan
      await approveMealPlan.mutateAsync(mealPlan.id);
      
      // Then generate shopping list from approved meals
      const approvedMeals = mealPlan.meals.filter(m => m.status === 'approved');
      const mealsWithIngredients = approvedMeals
        .filter(m => m.recipe_card?.ingredients)
        .map(m => ({
          mealName: m.meal_name,
          servings: m.servings,
          ingredients: (m.recipe_card?.ingredients || []) as Ingredient[],
        }));
      
      if (mealsWithIngredients.length > 0) {
        await generateShoppingList.mutateAsync({
          mealPlanId: mealPlan.id,
          meals: mealsWithIngredients,
        });
        toast.success('Shopping list generated!');
      }
    } catch (error) {
      console.error('Failed to finalise plan:', error);
    }
  };

  // Get meal for a specific day
  const getMealForDay = (day: string): MealWithRecipeCard | undefined => {
    return mealPlan?.meals.find(m => m.day_of_week === day);
  };

  // Check if all meals are approved
  const allMealsApproved = mealPlan?.meals.length === 7 && 
    mealPlan.meals.every(m => m.status === 'approved');

  // Check if there are rejected meals
  const hasRejectedMeals = mealPlan?.meals.some(m => m.status === 'rejected');

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
            mealPlanId={mealPlan.id}
          />
        ))}
      </div>

      {/* Action buttons for draft plans */}
      {!isPlanFinalised && mealPlan.meals.length > 0 && (
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* Finalise button - only when all approved */}
          {allMealsApproved && (
            <Button 
              size="lg" 
              onClick={handleFinalisePlan}
              disabled={isFinalising}
              className="min-h-[48px] gap-2 w-full sm:w-auto"
            >
              {isFinalising ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {generateShoppingList.isPending ? 'Creating shopping list...' : 'Finalising...'}
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Finalise Meal Plan
                </>
              )}
            </Button>
          )}

          {/* Regenerate rejected button */}
          {hasRejectedMeals && (
            <Button 
              variant="secondary"
              size="lg"
              onClick={handleRegenerateRejected}
              disabled={isGenerating}
              className="min-h-[48px] gap-2 w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Regenerate Rejected
                </>
              )}
            </Button>
          )}

          {/* Regenerate all button */}
          <Button 
            variant="outline"
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="gap-2 w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Regenerate All
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
