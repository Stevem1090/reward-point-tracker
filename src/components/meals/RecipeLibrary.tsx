import { useRecipes } from '@/hooks/useRecipes';
import { useRecipesStats } from '@/hooks/useRecipeStats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
  Plus,
  Search,
  BookOpen,
  Clock,
  Users,
  MoreVertical,
  Trash2,
  Eye,
  Pencil,
  Star,
  Flame,
  Scale,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Recipe, RecipeCard as RecipeCardType } from '@/types/meal';
import { AddRecipeDialog } from './AddRecipeDialog';
import { RecipeCardDialog } from './RecipeCardDialog';
import { EditRecipeDialog } from './EditRecipeDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { RecipeStats } from '@/hooks/useRecipeStats';
import { cn } from '@/lib/utils';

type SortKey = 'recent' | 'highest_rated' | 'most_cooked' | 'recently_eaten' | 'az';

const recipeToRecipeCard = (recipe: Recipe): RecipeCardType => ({
  id: recipe.id,
  meal_id: recipe.id,
  meal_name: recipe.name,
  image_url: recipe.image_url || null,
  ingredients: recipe.ingredients,
  steps: recipe.steps,
  base_servings: recipe.servings,
  html_content: null,
  estimated_calories_per_serving: null,
  created_at: recipe.created_at,
});

export function RecipeLibrary() {
  const { recipes, isLoading, deleteRecipe } = useRecipes();
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [filterSw, setFilterSw] = useState(false);
  const [filterQuick, setFilterQuick] = useState(false);
  const [filterUnrated, setFilterUnrated] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState<'website' | 'cookbook'>('website');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  const recipeIds = useMemo(() => recipes.map((r) => r.id), [recipes]);
  const { data: statsMap } = useRecipesStats(recipeIds);

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = recipes.filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q))
    );
    if (filterSw) list = list.filter((r: any) => r.sw_swips != null || r.sw_healthy_extra_type);
    if (filterQuick) list = list.filter((r) => (r.estimated_cook_minutes || 999) <= 30);
    if (filterUnrated) {
      list = list.filter((r) => {
        const s = statsMap?.get(r.id);
        return !s || s.ratingCount === 0;
      });
    }

    const stat = (id: string) => statsMap?.get(id);
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'highest_rated': {
          const ar = stat(a.id)?.avgRating ?? -1;
          const br = stat(b.id)?.avgRating ?? -1;
          return br - ar;
        }
        case 'most_cooked':
          return (stat(b.id)?.timesEaten ?? 0) - (stat(a.id)?.timesEaten ?? 0);
        case 'recently_eaten': {
          const ad = stat(a.id)?.lastEatenDate ?? '';
          const bd = stat(b.id)?.lastEatenDate ?? '';
          return bd.localeCompare(ad);
        }
        case 'az':
          return a.name.localeCompare(b.name);
        case 'recent':
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
    return list;
  }, [recipes, searchQuery, sort, filterSw, filterQuick, filterUnrated, statsMap]);

  const handleOpenAddDialog = (tab: 'website' | 'cookbook' = 'website') => {
    setDefaultTab(tab);
    setIsAddDialogOpen(true);
  };

  const handleDeleteRecipe = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteRecipe.mutateAsync(deleteConfirmId);
      toast.success('Recipe deleted');
    } catch {
      toast.error('Failed to delete recipe');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-hidden">
      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row gap-2 min-w-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <Button className="gap-2 min-h-[44px] w-full sm:w-auto shrink-0" onClick={() => handleOpenAddDialog('website')}>
          <Plus className="h-5 w-5" />
          <span>Add</span>
        </Button>
      </div>

      {/* Sort + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-auto min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="highest_rated">Highest rated</SelectItem>
            <SelectItem value="most_cooked">Most cooked</SelectItem>
            <SelectItem value="recently_eaten">Recently eaten</SelectItem>
            <SelectItem value="az">A–Z</SelectItem>
          </SelectContent>
        </Select>
        <FilterChip active={filterSw} onClick={() => setFilterSw((v) => !v)} icon={<Scale className="h-3 w-3" />}>
          Has SW
        </FilterChip>
        <FilterChip active={filterQuick} onClick={() => setFilterQuick((v) => !v)} icon={<Flame className="h-3 w-3" />}>
          Quick (&lt;30m)
        </FilterChip>
        <FilterChip active={filterUnrated} onClick={() => setFilterUnrated((v) => !v)} icon={<Star className="h-3 w-3" />}>
          Unrated
        </FilterChip>
      </div>

      {/* Empty state */}
      {recipes.length === 0 && (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <CardTitle className="text-xl">No recipes saved</CardTitle>
            <CardDescription>Add recipes from websites or take photos of cookbook pages</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2 justify-center pb-8">
            <Button variant="outline" className="gap-2" onClick={() => handleOpenAddDialog('website')}>
              From Website
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => handleOpenAddDialog('cookbook')}>
              From Cookbook Photo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No results */}
      {recipes.length > 0 && filteredRecipes.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No recipes match your filters</p>
          </CardContent>
        </Card>
      )}

      {/* Recipe list */}
      {filteredRecipes.length > 0 && (
        <div className="space-y-2">
          {filteredRecipes.map((recipe) => (
            <RecipeCardItem
              key={recipe.id}
              recipe={recipe}
              stats={statsMap?.get(recipe.id) ?? null}
              onDelete={() => setDeleteConfirmId(recipe.id)}
              onView={() => setSelectedRecipe(recipe)}
              onEdit={() => setEditingRecipe(recipe)}
            />
          ))}
        </div>
      )}

      <AddRecipeDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} defaultTab={defaultTab} />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this recipe from your library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecipe} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedRecipe && (
        <RecipeCardDialog
          open={!!selectedRecipe}
          onOpenChange={(open) => !open && setSelectedRecipe(null)}
          recipeCard={recipeToRecipeCard(selectedRecipe)}
          currentServings={selectedRecipe.servings}
          recipeUrl={selectedRecipe.recipe_url}
          estimatedCookMinutes={selectedRecipe.estimated_cook_minutes}
          recipeId={selectedRecipe.id}
          recipeSwData={{
            sw_swips: (selectedRecipe as any).sw_swips ?? null,
            sw_healthy_extra_type: (selectedRecipe as any).sw_healthy_extra_type ?? null,
            sw_healthy_extra_amount: (selectedRecipe as any).sw_healthy_extra_amount ?? null,
            sw_is_speed: (selectedRecipe as any).sw_is_speed ?? null,
          }}
        />
      )}

      {editingRecipe && (
        <EditRecipeDialog
          open={!!editingRecipe}
          onOpenChange={(open) => !open && setEditingRecipe(null)}
          recipe={editingRecipe}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-muted-foreground border-input hover:bg-muted'
      )}
    >
      {icon}
      {children}
    </button>
  );
}

interface RecipeCardItemProps {
  recipe: Recipe;
  stats: RecipeStats | null;
  onDelete: () => void;
  onView: () => void;
  onEdit: () => void;
}

function RecipeCardItem({ recipe, stats, onDelete, onView, onEdit }: RecipeCardItemProps) {
  const swSwips = (recipe as any).sw_swips;
  const hasSw = swSwips != null || (recipe as any).sw_healthy_extra_type;
  const ingredientsCount = recipe.ingredients?.length || 0;
  const isEmpty = ingredientsCount === 0;

  return (
    <Card
      className="hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
      onClick={onView}
    >
      <CardContent className="p-2.5 sm:py-4 sm:px-6">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt={recipe.name}
              className="h-16 w-20 sm:w-20 sm:h-20 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="h-16 w-20 sm:w-20 sm:h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-sm sm:text-base truncate flex-1">{recipe.name}</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="gap-2" onClick={(e) => { e.stopPropagation(); onView(); }}>
                    <Eye className="h-4 w-4" /> View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                    <Pencil className="h-4 w-4" /> Edit Recipe
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Stats row: stars + times + last eaten */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
              {stats && stats.avgRating != null ? (
                <span className="flex items-center gap-0.5 text-amber-600 font-medium">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {stats.avgRating.toFixed(1)}
                  <span className="text-muted-foreground font-normal">
                    ({stats.ratingCount})
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground italic">Unrated</span>
              )}
              {stats && stats.timesEaten > 0 && (
                <span className="text-muted-foreground">
                  {stats.timesEaten}× cooked
                </span>
              )}
              {stats?.lastEatenDate && (
                <span className="text-muted-foreground">
                  Last:{' '}
                  {formatDistanceToNow(new Date(stats.lastEatenDate), {
                    addSuffix: true,
                  }).replace('about ', '')}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1.5 text-xs text-muted-foreground">
              {recipe.estimated_cook_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {recipe.estimated_cook_minutes}m
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {recipe.servings}
              </span>
              {hasSw && (
                <Badge className="text-[10px] h-4 px-1.5 bg-purple-100 text-purple-800 border-purple-200">
                  SW {swSwips ?? 0}
                </Badge>
              )}
              {isEmpty && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-300 text-amber-700">
                  No ingredients
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
