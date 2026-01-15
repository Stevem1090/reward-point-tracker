import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMealPlans } from '@/hooks/useMealPlans';
import { useAIMealGeneration } from '@/hooks/useAIMealGeneration';
import { useShoppingListGeneration } from '@/hooks/useShoppingListGeneration';
import { useRecipeExtraction } from '@/hooks/useRecipeExtraction';
import { MealSlot } from './MealSlot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, Check, RefreshCw, Trash2 } from 'lucide-react';
import { DAYS_OF_WEEK, MealWithRecipeCard, DayOfWeek, Ingredient } from '@/types/meal';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MealPlanViewProps {
  weekStartDate: string;
}

export function MealPlanView({ weekStartDate }: MealPlanViewProps) {
const queryClient = useQueryClient();
  const { useMealPlanForWeek, createMealPlan, approveMealPlan, deleteMealPlan, saveAIRecipesToLibrary } = useMealPlans();
  const { data: mealPlan, isLoading, error, refetch } = useMealPlanForWeek(weekStartDate);
  const { generateMealPlan } = useAIMealGeneration();
  const { generateShoppingList } = useShoppingListGeneration();
  const { extractFromUrl } = useRecipeExtraction();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [finalisingStep, setFinalisingStep] = useState<string | null>(null);

  const isGenerating = generateMealPlan.isPending;
  const isFinalising = finalisingStep !== null;
  const isDeleting = deleteMealPlan.isPending;

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
    
    // Collect approved meal names to exclude from suggestions
    const approvedMealNames = mealPlan.meals
      .filter(m => m.status === 'approved')
      .map(m => m.meal_name);
    
    if (rejectedDays.length === 0) {
      toast.info('No rejected meals to regenerate');
      return;
    }

    try {
      await generateMealPlan.mutateAsync({
        mealPlanId: mealPlan.id,
        weekStartDate,
        daysToRegenerate: rejectedDays,
        excludeMeals: approvedMealNames,
      });
    } catch (error) {
      console.error('Failed to regenerate rejected meals:', error);
    }
  };

  const handleFinalisePlan = async () => {
    if (!mealPlan) return;
    
    try {
      const approvedMeals = mealPlan.meals.filter(m => m.status === 'approved');
      
      // Step 1: Extract recipes from URLs for all approved meals
      setFinalisingStep(`Extracting recipes... (0/${approvedMeals.length})`);
      
      let successCount = 0;
      for (const meal of approvedMeals) {
        try {
          // Call extractFromUrl for each meal - it handles both URL scraping
          // and fallback generation if URL fails or is empty
          await extractFromUrl.mutateAsync(
            {
              mealId: meal.id,
              url: meal.recipe_url || '',
              mealName: meal.meal_name,
            },
            {
              // Suppress individual toasts during bulk extraction
              onSuccess: () => {},
              onError: () => {},
            }
          );
          successCount++;
        } catch (error) {
          console.error(`Failed to extract recipe for ${meal.meal_name}:`, error);
          // Continue with other meals even if one fails
        }
        setFinalisingStep(`Extracting recipes... (${successCount}/${approvedMeals.length})`);
      }
      
      // Step 2: Refetch to get the newly created recipe_cards
      setFinalisingStep('Loading extracted recipes...');
      await queryClient.invalidateQueries({ queryKey: ['mealPlan', weekStartDate] });
      const { data: updatedPlan } = await refetch();
      
      if (!updatedPlan) {
        throw new Error('Failed to reload meal plan');
      }
      
      // Step 3: Generate shopping list from the extracted ingredients
      setFinalisingStep('Creating shopping list...');
      const mealsWithIngredients = updatedPlan.meals
        .filter(m => m.status === 'approved' && m.recipe_card?.ingredients)
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
      }
      
      // Step 4: Save AI-generated recipes to library for reuse
      setFinalisingStep('Saving recipes to library...');
      const mealsToSave = updatedPlan.meals
        .filter(m => m.status === 'approved')
        .map(m => ({
          meal_name: m.meal_name,
          description: m.description,
          recipe_url: m.recipe_url,
          source_type: m.source_type,
          recipe_id: m.recipe_id,
          estimated_cook_minutes: m.estimated_cook_minutes,
          recipe_card: m.recipe_card ? {
            ingredients: m.recipe_card.ingredients as Ingredient[],
            steps: m.recipe_card.steps,
            base_servings: m.recipe_card.base_servings,
          } : undefined,
        }));
      
      const savedCount = await saveAIRecipesToLibrary(mealsToSave);
      
      // Step 5: Mark plan as approved
      setFinalisingStep('Finalising...');
      await approveMealPlan.mutateAsync(mealPlan.id);
      
      const savedMessage = savedCount > 0 
        ? ` ${savedCount} recipe${savedCount > 1 ? 's' : ''} saved to library.`
        : '';
      toast.success(`Meal plan approved! Shopping list ready.${savedMessage}`);
    } catch (error) {
      console.error('Failed to finalise plan:', error);
      toast.error('Failed to finalise meal plan');
    } finally {
      setFinalisingStep(null);
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
          <CardContent className="py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <Check className="h-5 w-5" />
              <span className="font-medium">Meal plan approved! Check the Shopping tab for your list.</span>
            </div>
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
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
                  {finalisingStep || 'Finalising...'}
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

          {/* Delete plan button */}
          <Button 
            variant="ghost"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={isDeleting}
            className="gap-2 w-full sm:w-auto text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete Plan
          </Button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meal plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the meal plan and all its meals. You can generate a new plan afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (mealPlan) {
                  await deleteMealPlan.mutateAsync(mealPlan.id);
                  setIsDeleteDialogOpen(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete Plan'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
