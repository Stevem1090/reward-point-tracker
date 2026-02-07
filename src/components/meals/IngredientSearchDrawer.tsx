import { useState, useMemo } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { MealWithRecipeCard, Ingredient } from '@/types/meal';

interface IngredientSearchDrawerProps {
  meals: MealWithRecipeCard[];
}

interface SearchResult {
  mealName: string;
  ingredient: Ingredient;
}

export function IngredientSearchDrawer({ meals }: IngredientSearchDrawerProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const results = useMemo<SearchResult[]>(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];

    return meals.flatMap((meal) => {
      const ingredients = (meal.recipe_card?.ingredients ?? []) as Ingredient[];
      return ingredients
        .filter((ing) => ing.name.toLowerCase().includes(term))
        .map((ing) => ({ mealName: meal.recipe_card?.meal_name ?? meal.meal_name, ingredient: ing }));
    });
  }, [searchTerm, meals]);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Search className="h-4 w-4" />
          Search Ingredients
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Search Ingredients</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2">
          <Input
            placeholder="e.g. mushrooms"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
        <ScrollArea className="h-[300px] px-4 pb-4">
          {searchTerm.trim() === '' ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Type an ingredient name to search across this week's recipes.
            </p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No matching ingredients found.
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((r, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2 text-sm border-b pb-2 last:border-0">
                  <span className="font-medium truncate min-w-0">{r.mealName}</span>
                  <span className="text-muted-foreground shrink-0">
                    {r.ingredient.quantity} {r.ingredient.unit} {r.ingredient.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
