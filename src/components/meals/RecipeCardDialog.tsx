import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RecipeCard, Ingredient } from '@/types/meal';
import { Clock, Users, ExternalLink, Printer } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { scaleIngredients } from '@/utils/scaleIngredients';
import { generateRecipeCardHtml, RecipeCardData } from '@/utils/generateRecipeCardHtml';

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
  // Scale ingredients based on current servings vs base servings
  const scaledIngredients = scaleIngredients(
    recipeCard.ingredients,
    recipeCard.base_servings,
    currentServings
  );

  const handlePrint = () => {
    const recipeData: RecipeCardData = {
      title: recipeCard.meal_name,
      servings: currentServings,
      cookMinutes: estimatedCookMinutes || null,
      imageUrl: recipeCard.image_url,
      ingredients: scaledIngredients,
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
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

        <ScrollArea className="flex-1 min-h-0 pr-4">
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
