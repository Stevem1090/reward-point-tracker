import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RecipeCard, Ingredient } from '@/types/meal';
import { Clock, Users, ExternalLink, Printer, AlertCircle, Flame } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { scaleIngredients } from '@/utils/scaleIngredients';
import { generateRecipeCardHtml, RecipeCardData } from '@/utils/generateRecipeCardHtml';
import { estimateCaloriesForRecipeCard } from '@/hooks/useCalorieEstimation';
import { useQueryClient } from '@tanstack/react-query';

interface RecipeCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeCard: RecipeCard;
  currentServings: number;
  recipeUrl?: string | null;
  estimatedCookMinutes?: number | null;
}

export function RecipeCardDialog({
  open,
  onOpenChange,
  recipeCard,
  currentServings,
  recipeUrl,
  estimatedCookMinutes,
}: RecipeCardDialogProps) {
  const queryClient = useQueryClient();
  // Local cache of estimated calories so we can show the result immediately
  // after a lazy backfill, without waiting for the next refetch cycle.
  const [localCalories, setLocalCalories] = useState<number | null>(
    recipeCard.estimated_calories_per_serving ?? null
  );

  useEffect(() => {
    setLocalCalories(recipeCard.estimated_calories_per_serving ?? null);
  }, [recipeCard.id, recipeCard.estimated_calories_per_serving]);

  // Lazy backfill: when dialog opens for a card with ingredients but no calorie
  // estimate yet, trigger one (fire-and-forget). Skipped for library previews
  // where meal_id === id (synthetic recipe cards constructed from saved recipes).
  useEffect(() => {
    const isSyntheticPreview = recipeCard.meal_id === recipeCard.id;
    if (
      open &&
      !isSyntheticPreview &&
      !recipeCard.estimated_calories_per_serving &&
      recipeCard.ingredients?.length > 0
    ) {
      estimateCaloriesForRecipeCard({
        recipeCardId: recipeCard.id,
        ingredients: recipeCard.ingredients,
        servings: recipeCard.base_servings,
        mealName: recipeCard.meal_name,
      }).then((cals) => {
        if (cals) {
          setLocalCalories(cals);
          queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipeCard.id]);

  // Check if extraction failed (empty ingredients and steps)
  const extractionFailed = recipeCard.ingredients.length === 0 && recipeCard.steps.length === 0;

  // Scale ingredients based on current servings vs base servings
  const scaledIngredients = scaleIngredients(
    recipeCard.ingredients,
    recipeCard.base_servings,
    currentServings
  );

  // Extract domain from URL for display
  const getUrlDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain;
    } catch {
      return url;
    }
  };

  const handlePrint = () => {
    // Pass ORIGINAL ingredients - generateRecipeCardHtml will scale them
    const recipeData: RecipeCardData = {
      title: recipeCard.meal_name,
      servings: currentServings,
      cookMinutes: estimatedCookMinutes || null,
      imageUrl: recipeCard.image_url,
      ingredients: recipeCard.ingredients,
      steps: recipeCard.steps,
      sourceUrl: recipeUrl,
      baseServings: recipeCard.base_servings,
    };
    
    const htmlContent = generateRecipeCardHtml(recipeData);
    
    // Open in new window and trigger print
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] !grid !grid-rows-[auto_1fr] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl">{recipeCard.meal_name}</DialogTitle>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {estimatedCookMinutes && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {estimatedCookMinutes} mins
              </Badge>
            )}
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {currentServings} servings
            </Badge>
            {localCalories ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-500" />
                ~{localCalories} kcal / serving
              </Badge>
            ) : null}
            {recipeUrl && (
              <a
                href={recipeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View original
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5"
              onClick={handlePrint}
            >
              <Printer className="h-3.5 w-3.5" />
              Print A4
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="h-full overflow-hidden pr-4">
          {extractionFailed ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-orange-500" />
              <div>
                <h3 className="font-medium text-lg">Unable to Extract Recipe</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  We couldn't automatically extract the recipe from this website.
                </p>
              </div>
              
              {recipeUrl && (
                <a
                  href={recipeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline mt-4"
                >
                  <ExternalLink className="h-4 w-4" />
                  View recipe on {getUrlDomain(recipeUrl)}
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {/* Image */}
              {recipeCard.image_url && (
                <img
                  src={recipeCard.image_url}
                  alt={recipeCard.meal_name}
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}

              {/* Ingredients */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Ingredients</h3>
                <ul className="space-y-2">
                  {scaledIngredients.map((ing: Ingredient, index: number) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-muted-foreground shrink-0 w-20 text-right">
                        {ing.quantity} {ing.unit}
                      </span>
                      <span>{ing.name}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Steps */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Instructions</h3>
                <ol className="space-y-4">
                  {recipeCard.steps.map((step: string, index: number) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <p className="pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
