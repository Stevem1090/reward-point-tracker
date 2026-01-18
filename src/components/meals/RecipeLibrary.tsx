import { useRecipes } from '@/hooks/useRecipes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, BookOpen, Clock, Users, MoreVertical, Trash2, Eye, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Recipe, RecipeCard as RecipeCardType } from '@/types/meal';
import { AddRecipeDialog } from './AddRecipeDialog';
import { RecipeCardDialog } from './RecipeCardDialog';
import { EditRecipeDialog } from './EditRecipeDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

// Convert Recipe to RecipeCard format for the dialog
const recipeToRecipeCard = (recipe: Recipe): RecipeCardType => ({
  id: recipe.id,
  meal_id: recipe.id,
  meal_name: recipe.name,
  image_url: recipe.image_url || null,
  ingredients: recipe.ingredients,
  steps: recipe.steps,
  base_servings: recipe.servings,
  html_content: null,
  created_at: recipe.created_at,
});

export function RecipeLibrary() {
  const { recipes, isLoading, deleteRecipe } = useRecipes();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState<'website' | 'cookbook'>('website');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  const filteredRecipes = recipes.filter(recipe =>
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <div className="space-y-4 overflow-hidden">
      {/* Search and add */}
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

      {/* Empty state */}
      {recipes.length === 0 && (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <CardTitle className="text-xl">No recipes saved</CardTitle>
            <CardDescription>
              Add recipes from websites or take photos of cookbook pages
            </CardDescription>
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
            <p className="text-muted-foreground">No recipes match "{searchQuery}"</p>
          </CardContent>
        </Card>
      )}

      {/* Recipe grid */}
      {filteredRecipes.length > 0 && (
        <div className="space-y-3">
          {filteredRecipes.map((recipe) => (
            <RecipeCardItem 
              key={recipe.id} 
              recipe={recipe} 
              onDelete={() => setDeleteConfirmId(recipe.id)}
              onView={() => setSelectedRecipe(recipe)}
              onEdit={() => setEditingRecipe(recipe)}
            />
          ))}
        </div>
      )}

      {/* Add Recipe Dialog */}
      <AddRecipeDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        defaultTab={defaultTab}
      />

      {/* Delete Confirmation Dialog */}
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

      {/* Recipe Detail Dialog */}
      {selectedRecipe && (
        <RecipeCardDialog
          open={!!selectedRecipe}
          onOpenChange={(open) => !open && setSelectedRecipe(null)}
          recipeCard={recipeToRecipeCard(selectedRecipe)}
          currentServings={selectedRecipe.servings}
          recipeUrl={selectedRecipe.recipe_url}
          estimatedCookMinutes={selectedRecipe.estimated_cook_minutes}
        />
      )}

      {/* Edit Recipe Dialog */}
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

interface RecipeCardItemProps {
  recipe: Recipe;
  onDelete: () => void;
  onView: () => void;
  onEdit: () => void;
}

function RecipeCardItem({ recipe, onDelete, onView, onEdit }: RecipeCardItemProps) {
  return (
    <Card 
      className="hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
      onClick={onView}
    >
      <CardContent className="p-2.5 sm:py-4 sm:px-6">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          {/* Thumbnail */}
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

          {/* Info */}
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
                    <Eye className="h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                    <Pencil className="h-4 w-4" />
                    Edit Recipe
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {recipe.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 sm:line-clamp-2 mt-0.5">
                {recipe.description}
              </p>
            )}
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm text-muted-foreground">
              {recipe.estimated_cook_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {recipe.estimated_cook_minutes} mins
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {recipe.servings} servings
              </span>
              <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                {recipe.source_type === 'website' ? 'Web' : 'Cookbook'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
