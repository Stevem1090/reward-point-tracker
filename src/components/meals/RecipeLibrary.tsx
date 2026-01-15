import { useRecipes } from '@/hooks/useRecipes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, BookOpen, Clock, Users } from 'lucide-react';
import { useState } from 'react';
import { Recipe } from '@/types/meal';

export function RecipeLibrary() {
  const { recipes, isLoading, deleteRecipe } = useRecipes();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecipes = recipes.filter(recipe =>
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button className="gap-2 min-h-[44px]">
          <Plus className="h-5 w-5" />
          <span className="hidden sm:inline">Add Recipe</span>
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
            <Button variant="outline" className="gap-2">
              From Website
            </Button>
            <Button variant="outline" className="gap-2">
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
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}

interface RecipeCardProps {
  recipe: Recipe;
}

function RecipeCard({ recipe }: RecipeCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-3 sm:py-4 sm:px-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {/* Thumbnail */}
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt={recipe.name}
              className="w-full h-32 sm:w-20 sm:h-20 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-full h-32 sm:w-20 sm:h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-base truncate">{recipe.name}</h3>
            {recipe.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
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
