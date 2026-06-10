import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RecipeCard, Ingredient } from '@/types/meal';
import {
  Clock,
  Users,
  ExternalLink,
  Printer,
  AlertCircle,
  Flame,
  Loader2,
  RefreshCw,
  Star,
  Scale,
  MoreHorizontal,
  Plus,
  Pencil,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { scaleIngredients } from '@/utils/scaleIngredients';
import { generateRecipeCardHtml, RecipeCardData } from '@/utils/generateRecipeCardHtml';
import { estimateCaloriesForRecipeCard } from '@/hooks/useCalorieEstimation';
import { useQueryClient } from '@tanstack/react-query';
import { useRecipeStats } from '@/hooks/useRecipeStats';
import { useSwLog, getWeekStartMonday, formatDate } from '@/hooks/useSwLog';
import { HealthyExtraType } from '@/types/slimmingWorld';
import { SwInfoDialog } from './SwInfoDialog';

interface RecipeCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeCard: RecipeCard;
  currentServings: number;
  recipeUrl?: string | null;
  estimatedCookMinutes?: number | null;
  recipeId?: string | null;
  recipeSwData?: {
    sw_swips: number | null;
    sw_healthy_extra_type: HealthyExtraType | null;
    sw_healthy_extra_amount: number | null;
    sw_is_speed: boolean | null;
  } | null;
  /** Pass meal context to enable in-place SW editing (auto-creates a library recipe if needed). */
  mealId?: string | null;
}

export function RecipeCardDialog({
  open,
  onOpenChange,
  recipeCard,
  currentServings,
  recipeUrl,
  estimatedCookMinutes,
  recipeId,
  recipeSwData,
  mealId,
}: RecipeCardDialogProps) {
  const queryClient = useQueryClient();
  const [localCalories, setLocalCalories] = useState<number | null>(
    recipeCard.estimated_calories_per_serving ?? null
  );
  const [calorieStatus, setCalorieStatus] = useState<'idle' | 'loading' | 'rate_limited' | 'credits_exhausted' | 'error'>('idle');
  const [swDialogOpen, setSwDialogOpen] = useState(false);
  const { data: stats } = useRecipeStats(recipeId ?? null);
  const swLog = useSwLog(getWeekStartMonday(new Date()));

  const hasSw = !!(recipeSwData && (recipeSwData.sw_swips != null || recipeSwData.sw_healthy_extra_type));

  const handleLogToSw = () => {
    if (!recipeId || !recipeSwData) return;
    swLog.addEntry.mutate({
      log_date: formatDate(new Date()),
      entry_type: 'recipe',
      recipe: {
        id: recipeId,
        name: recipeCard.meal_name,
        sw_swips: recipeSwData.sw_swips,
        sw_healthy_extra_type: recipeSwData.sw_healthy_extra_type,
        sw_healthy_extra_amount: recipeSwData.sw_healthy_extra_amount,
        sw_is_speed: recipeSwData.sw_is_speed,
      },
    });
  };

  useEffect(() => {
    setLocalCalories(recipeCard.estimated_calories_per_serving ?? null);
    setCalorieStatus('idle');
  }, [recipeCard.id, recipeCard.estimated_calories_per_serving]);

  const isSyntheticPreview = recipeCard.meal_id === recipeCard.id;
  const canEstimate =
    !isSyntheticPreview &&
    recipeCard.ingredients?.length > 0 &&
    recipeCard.id;

  const runEstimate = async () => {
    if (!canEstimate) return;
    setCalorieStatus('loading');
    const result = await estimateCaloriesForRecipeCard({
      recipeCardId: recipeCard.id,
      ingredients: recipeCard.ingredients,
      servings: recipeCard.base_servings,
      mealName: recipeCard.meal_name,
    });
    if (result.status === 'ok') {
      setLocalCalories(result.calories);
      setCalorieStatus('idle');
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
    } else if (result.status === 'rate_limited') {
      setCalorieStatus('rate_limited');
    } else if (result.status === 'credits_exhausted') {
      setCalorieStatus('credits_exhausted');
    } else {
      setCalorieStatus('error');
    }
  };

  useEffect(() => {
    if (open && canEstimate && !recipeCard.estimated_calories_per_serving) {
      runEstimate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipeCard.id]);

  const extractionFailed = recipeCard.ingredients.length === 0 && recipeCard.steps.length === 0;

  const scaledIngredients = scaleIngredients(
    recipeCard.ingredients,
    recipeCard.base_servings,
    currentServings
  );

  const getUrlDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const handlePrint = () => {
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
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
  };

  // Inline metadata item — neutral muted styling, no coloured pills.
  const MetaItem = ({ icon: Icon, children }: { icon: any; children: React.ReactNode }) => (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );

  const hasOverflowActions =
    !!mealId || (recipeId && hasSw) || true; // print always available

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] !grid !grid-rows-[auto_1fr] overflow-hidden">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <DialogTitle className="text-xl leading-tight">{recipeCard.meal_name}</DialogTitle>
            {hasOverflowActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 -mt-1 text-muted-foreground"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {recipeId && hasSw && (
                    <DropdownMenuItem
                      onClick={handleLogToSw}
                      disabled={swLog.addEntry.isPending}
                    >
                      <Scale className="h-4 w-4 mr-2" />
                      Log to SW
                    </DropdownMenuItem>
                  )}
                  {mealId && (
                    <DropdownMenuItem onClick={() => setSwDialogOpen(true)}>
                      {hasSw ? (
                        <Pencil className="h-4 w-4 mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      {hasSw ? 'Edit SW info' : 'Add SW info'}
                    </DropdownMenuItem>
                  )}
                  {(recipeId && hasSw) || mealId ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print A4
                  </DropdownMenuItem>
                  {recipeUrl && (
                    <DropdownMenuItem asChild>
                      <a href={recipeUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View original
                      </a>
                    </DropdownMenuItem>
                  )}
                  {calorieStatus === 'rate_limited' || calorieStatus === 'error' ? (
                    <DropdownMenuItem onClick={runEstimate}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry calorie estimate
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Single neutral metadata strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
            {estimatedCookMinutes && (
              <MetaItem icon={Clock}>{estimatedCookMinutes} min</MetaItem>
            )}
            <MetaItem icon={Users}>{currentServings} servings</MetaItem>
            {localCalories ? (
              <MetaItem icon={Flame}>~{localCalories} kcal</MetaItem>
            ) : calorieStatus === 'loading' ? (
              <MetaItem icon={Loader2}>
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Estimating…
                </span>
              </MetaItem>
            ) : null}
            {stats && stats.avgRating != null && (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {stats.avgRating.toFixed(1)}
                {stats.ratingCount > 0 && ` (${stats.ratingCount})`}
                {stats.timesEaten > 0 && ` · cooked ${stats.timesEaten}×`}
              </span>
            )}
            {hasSw && recipeSwData && (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Scale className="h-3.5 w-3.5" />
                {recipeSwData.sw_swips != null ? `${recipeSwData.sw_swips} Swips` : 'SW'}
                {recipeSwData.sw_is_speed ? ' · Speed' : ''}
              </span>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="h-full overflow-hidden pr-4">
          {extractionFailed ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
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
              {recipeCard.image_url && (
                <img
                  src={recipeCard.image_url}
                  alt={recipeCard.meal_name}
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}

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

              <div>
                <h3 className="font-semibold text-lg mb-3">Instructions</h3>
                <ol className="space-y-4">
                  {recipeCard.steps.map((step: string, index: number) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-medium">
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

      {mealId && (
        <SwInfoDialog
          open={swDialogOpen}
          onOpenChange={setSwDialogOpen}
          mealId={mealId}
          recipeId={recipeId ?? null}
          mealName={recipeCard.meal_name}
          servings={recipeCard.base_servings}
          estimatedCookMinutes={estimatedCookMinutes ?? null}
          recipeUrl={recipeUrl ?? null}
          ingredients={recipeCard.ingredients}
          steps={recipeCard.steps}
          imageUrl={recipeCard.image_url ?? null}
          initial={recipeSwData ?? null}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
          }}
        />
      )}
    </Dialog>
  );
}
