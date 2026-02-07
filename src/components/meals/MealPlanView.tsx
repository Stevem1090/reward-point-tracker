import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMealPlans } from '@/hooks/useMealPlans';
import { useAIMealGeneration } from '@/hooks/useAIMealGeneration';
import { useShoppingListGeneration } from '@/hooks/useShoppingListGeneration';
import { useRecipeExtraction } from '@/hooks/useRecipeExtraction';
import { MealSlot } from './MealSlot';
import { SortableMealSlot } from './SortableMealSlot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, Check, RefreshCw, Trash2, PenLine, X } from 'lucide-react';
import { IngredientSearchDrawer } from './IngredientSearchDrawer';
import { DAYS_OF_WEEK, MealWithRecipeCard, DayOfWeek, Ingredient } from '@/types/meal';
import { scaleIngredients } from '@/utils/scaleIngredients';
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
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

interface MealPlanViewProps {
  weekStartDate: string;
}

export function MealPlanView({ weekStartDate }: MealPlanViewProps) {
  const queryClient = useQueryClient();
  const { useMealPlanForWeek, createMealPlan, createBlankMealPlan, approveMealPlan, deleteMealPlan, saveAIRecipesToLibrary, reorderMeals } = useMealPlans();
  const { data: mealPlan, isLoading, error, refetch } = useMealPlanForWeek(weekStartDate);
  const { generateMealPlan } = useAIMealGeneration();
  const { generateShoppingList } = useShoppingListGeneration();
  const { extractFromUrl } = useRecipeExtraction();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [dismissedWeeks, setDismissedWeeks] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('dismissedMealPlanBanners');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const isBannerDismissed = dismissedWeeks.has(weekStartDate);

  const dismissBanner = () => {
    const updated = new Set(dismissedWeeks);
    updated.add(weekStartDate);
    setDismissedWeeks(updated);
    localStorage.setItem('dismissedMealPlanBanners', JSON.stringify([...updated]));
  };
  const [finalisingStep, setFinalisingStep] = useState<string | null>(null);

  // Drag and drop sensors with activation constraints
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const isGenerating = generateMealPlan.isPending;
  const isCreatingBlank = createBlankMealPlan.isPending;
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

  const handleCreateBlankPlan = async () => {
    try {
      await createBlankMealPlan.mutateAsync(weekStartDate);
    } catch (error) {
      console.error('Failed to create blank plan:', error);
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
    
    // Collect ALL rejected meals with their reasons to prevent re-suggestion
    const rejectedMeals = mealPlan.meals
      .filter(m => m.status === 'rejected')
      .map(m => ({
        name: m.meal_name,
        reason: m.rejection_reason || 'no_reason'
      }));
    
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
        rejectedMeals: rejectedMeals,
      });
    } catch (error) {
      console.error('Failed to regenerate rejected meals:', error);
    }
  };

  const handleFillEmptySlots = async () => {
    if (!mealPlan) return;
    
    // Find days with blank meals (empty meal_name)
    const blankDays = mealPlan.meals
      .filter(m => !m.meal_name || m.meal_name.trim() === '')
      .map(m => m.day_of_week);
    
    // Collect filled meal names to exclude from suggestions
    const filledMealNames = mealPlan.meals
      .filter(m => m.meal_name && m.meal_name.trim() !== '')
      .map(m => m.meal_name);
    
    if (blankDays.length === 0) {
      toast.info('No empty slots to fill');
      return;
    }

    try {
      await generateMealPlan.mutateAsync({
        mealPlanId: mealPlan.id,
        weekStartDate,
        daysToRegenerate: blankDays,
        excludeMeals: filledMealNames,
      });
    } catch (error) {
      console.error('Failed to fill empty slots:', error);
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
          if (meal.recipe_id) {
            // Library meal - create recipe_card directly from saved recipe data
            const { data: recipe } = await supabase
              .from('recipes')
              .select('name, ingredients, steps, servings, image_url')
              .eq('id', meal.recipe_id)
              .single();

            if (recipe) {
              const { data: existing } = await supabase
                .from('recipe_cards')
                .select('id')
                .eq('meal_id', meal.id)
                .maybeSingle();

              const cardData = {
                meal_id: meal.id,
                meal_name: recipe.name,
                image_url: recipe.image_url,
                ingredients: recipe.ingredients,
                steps: recipe.steps,
                base_servings: recipe.servings,
              };

              if (existing) {
                await supabase.from('recipe_cards').update(cardData).eq('id', existing.id);
              } else {
                await supabase.from('recipe_cards').insert([cardData]);
              }
              successCount++;
            }
          } else {
            // Non-library meal - extract recipe from URL (with AI fallback)
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
          }
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
        .map(m => {
          const baseServings = m.recipe_card?.base_servings || 4;
          const targetServings = m.servings;
          const rawIngredients = (m.recipe_card?.ingredients || []) as Ingredient[];
          
          // Scale ingredients from base servings to user's target servings
          const scaledIngredients = scaleIngredients(rawIngredients, baseServings, targetServings);
          
          return {
            mealName: m.meal_name,
            servings: targetServings,
            ingredients: scaledIngredients,
          };
        });
      
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

  // Get meals sorted by their current day positions (for drag-and-drop)
  const getSortedMeals = (): MealWithRecipeCard[] => {
    if (!mealPlan?.meals) return [];
    return DAYS_OF_WEEK.map(day => getMealForDay(day)).filter((m): m is MealWithRecipeCard => !!m);
  };

  // Handle drag end - reorder meals by updating their day_of_week
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !mealPlan) return;

    const sortedMeals = getSortedMeals();
    const oldIndex = sortedMeals.findIndex(m => m.id === active.id);
    const newIndex = sortedMeals.findIndex(m => m.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder the array
    const reorderedMeals = arrayMove(sortedMeals, oldIndex, newIndex);

    // Create updates: assign each meal the day corresponding to its new position
    const updates = reorderedMeals.map((meal, index) => ({
      mealId: meal.id,
      dayOfWeek: DAYS_OF_WEEK[index]
    }));

    await reorderMeals.mutateAsync(updates);
  };

  // Check if all meals are approved (and have names - not blank)
  const allMealsApproved = mealPlan?.meals.length === 7 && 
    mealPlan.meals.every(m => m.status === 'approved' && m.meal_name && m.meal_name.trim() !== '');

  // Check if there are rejected meals
  const hasRejectedMeals = mealPlan?.meals.some(m => m.status === 'rejected');

  // Check if there are blank slots (empty meal_name)
  const hasBlankSlots = mealPlan?.meals.some(m => !m.meal_name || m.meal_name.trim() === '');

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
            Generate an AI-powered plan or create your own from scratch
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row justify-center gap-3 pb-8">
          <Button 
            size="lg" 
            onClick={handleGeneratePlan}
            disabled={isGenerating || isCreatingBlank || createMealPlan.isPending}
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
          <Button 
            variant="outline"
            size="lg" 
            onClick={handleCreateBlankPlan}
            disabled={isGenerating || isCreatingBlank || createMealPlan.isPending}
            className="min-h-[48px] gap-2"
          >
            {isCreatingBlank ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <PenLine className="h-5 w-5" />
                Create from Scratch
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
      {isPlanFinalised && !isBannerDismissed && (
        <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <CardContent className="py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <Check className="h-5 w-5" />
              <span className="font-medium">Meal plan approved! Check the Shopping tab for your list.</span>
            </div>
            <Button 
              variant="ghost"
              size="icon"
              onClick={dismissBanner}
              className="shrink-0 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Ingredient search for finalized plans */}
      {isPlanFinalised && (
        <div className="flex justify-end">
          <IngredientSearchDrawer meals={mealPlan.meals} />
        </div>
      )}

      {/* Meal slots for each day - with drag-and-drop for finalized plans */}
      {isPlanFinalised ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={getSortedMeals().map(m => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {DAYS_OF_WEEK.map((day) => {
                const meal = getMealForDay(day);
                return meal ? (
                  <SortableMealSlot
                    key={meal.id}
                    meal={meal}
                    day={day}
                    isPlanFinalised={isPlanFinalised}
                    mealPlanId={mealPlan.id}
                  />
                ) : null;
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
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
      )}

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

          {/* Fill empty slots with AI button */}
          {hasBlankSlots && (
            <Button 
              variant="secondary"
              size="lg"
              onClick={handleFillEmptySlots}
              disabled={isGenerating}
              className="min-h-[48px] gap-2 w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Fill Empty with AI
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
