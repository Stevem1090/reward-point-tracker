import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { useRecipes } from '@/hooks/useRecipes';
import { useDirectRecipeExtraction } from '@/hooks/useDirectRecipeExtraction';
import { Recipe, DayOfWeek } from '@/types/meal';
import { Clock, Users, BookOpen, Pencil, Loader2, Search, Camera, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';


interface SwapMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: DayOfWeek;
  mealId?: string;
  onSwap: (data: {
    mealName: string;
    description?: string;
    recipeUrl?: string;
    servings: number;
    estimatedCookMinutes?: number;
    recipeId?: string;
  }) => void;
  isSwapping?: boolean;
}

const MAX_IMAGES = 5;

export function SwapMealDialog({ 
  open, 
  onOpenChange, 
  day, 
  mealId,
  onSwap,
  isSwapping 
}: SwapMealDialogProps) {
  const { recipes, isLoading: recipesLoading } = useRecipes();
  const { processCookbook } = useDirectRecipeExtraction();
  const [activeTab, setActiveTab] = useState<'library' | 'custom' | 'photo'>('custom');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom meal form state
  const [customMeal, setCustomMeal] = useState({
    mealName: '',
    description: '',
    recipeUrl: '',
    servings: 4,
    estimatedCookMinutes: 30,
  });

  // Photo tab state
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [cookbookTitle, setCookbookTitle] = useState('');
  const [photoRecipeName, setPhotoRecipeName] = useState('');

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectRecipe = (recipe: Recipe) => {
    onSwap({
      mealName: recipe.name,
      description: recipe.description || undefined,
      recipeUrl: recipe.recipe_url || undefined,
      servings: recipe.servings,
      estimatedCookMinutes: recipe.estimated_cook_minutes || undefined,
      recipeId: recipe.id,
    });
  };

  const handleCustomSubmit = () => {
    if (!customMeal.mealName.trim()) return;
    
    onSwap({
      mealName: customMeal.mealName.trim(),
      description: customMeal.description.trim() || undefined,
      recipeUrl: customMeal.recipeUrl.trim() || undefined,
      servings: customMeal.servings,
      estimatedCookMinutes: customMeal.estimatedCookMinutes || undefined,
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`You can add up to ${MAX_IMAGES} photos.`);
      e.target.value = '';
      return;
    }

    const toAdd = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.error(`Only the first ${remaining} photo(s) were added (max ${MAX_IMAGES}).`);
    }

    toAdd.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" is too large. Use images under 10MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = ev.target?.result as string;
        setImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, { file, preview }]));
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePhotoSubmit = async () => {
    if (images.length === 0) {
      toast.error('Please add at least one photo');
      return;
    }
    try {
      const recipe = await processCookbook.mutateAsync({
        imagesData: images.map((i) => i.preview),
        cookbookTitle: cookbookTitle.trim() || undefined,
        recipeName: photoRecipeName.trim() || undefined,
      });

      onSwap({
        mealName: recipe.name,
        description: recipe.description || undefined,
        recipeUrl: recipe.source_url || undefined,
        servings: recipe.servings,
        estimatedCookMinutes: recipe.estimated_cook_minutes,
      });
    } catch {
      // toast handled in hook
    }
  };

  const resetForm = () => {
    setCustomMeal({
      mealName: '',
      description: '',
      recipeUrl: '',
      servings: 4,
      estimatedCookMinutes: 30,
    });
    setSearchQuery('');
    setActiveTab('custom');
    setImages([]);
    setCookbookTitle('');
    setPhotoRecipeName('');
  };

  const isExtractingPhoto = processCookbook.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mealId ? `Replace meal for ${day}` : `Add meal for ${day}`}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'library' | 'custom' | 'photo')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="library" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Library</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-1.5">
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Custom</span>
            </TabsTrigger>
            <TabsTrigger value="photo" className="gap-1.5">
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Photo</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="mt-4">
            {recipesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No recipes in your library yet.</p>
                <p className="text-sm mt-1">Add recipes from the Recipe Library tab.</p>
              </div>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search recipes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ScrollArea className="h-[300px] pr-4">
                  {filteredRecipes.length === 0 ? (
                    <p className="text-center py-8 text-sm text-muted-foreground">No matching recipes.</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredRecipes.map((recipe) => (
                        <Card 
                          key={recipe.id} 
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => !isSwapping && handleSelectRecipe(recipe)}
                        >
                          <CardContent className="p-3">
                            <h4 className="font-medium">{recipe.name}</h4>
                            {recipe.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                {recipe.description}
                              </p>
                            )}
                            <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                              {recipe.estimated_cook_minutes && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {recipe.estimated_cook_minutes} mins
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {recipe.servings} servings
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </TabsContent>

          <TabsContent value="custom" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mealName">Meal Name *</Label>
              <Input
                id="mealName"
                value={customMeal.mealName}
                onChange={(e) => setCustomMeal(prev => ({ ...prev, mealName: e.target.value }))}
                placeholder="e.g., Spaghetti Bolognese"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={customMeal.description}
                onChange={(e) => setCustomMeal(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional short description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipeUrl">Recipe URL</Label>
              <Input
                id="recipeUrl"
                type="url"
                value={customMeal.recipeUrl}
                onChange={(e) => setCustomMeal(prev => ({ ...prev, recipeUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="servings">Servings</Label>
                <Input
                  id="servings"
                  type="number"
                  min={1}
                  max={20}
                  value={customMeal.servings}
                  onChange={(e) => setCustomMeal(prev => ({ ...prev, servings: parseInt(e.target.value) || 4 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cookTime">Cook Time (mins)</Label>
                <Input
                  id="cookTime"
                  type="number"
                  min={0}
                  value={customMeal.estimatedCookMinutes}
                  onChange={(e) => setCustomMeal(prev => ({ ...prev, estimatedCookMinutes: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCustomSubmit} 
                disabled={!customMeal.mealName.trim() || isSwapping}
              >
                {isSwapping ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  mealId ? 'Replace Meal' : 'Add Meal'
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="photo" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cookbook-title-swap">Cookbook Title (optional)</Label>
              <Input
                id="cookbook-title-swap"
                value={cookbookTitle}
                onChange={(e) => setCookbookTitle(e.target.value)}
                placeholder="e.g., The Joy of Cooking"
                disabled={isExtractingPhoto}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipe-name-swap">Recipe Name (optional)</Label>
              <Input
                id="recipe-name-swap"
                value={photoRecipeName}
                onChange={(e) => setPhotoRecipeName(e.target.value)}
                placeholder="e.g., Chicken Tikka Masala"
                disabled={isExtractingPhoto}
              />
            </div>

            <div className="space-y-2">
              <Label>Cookbook Photos</Label>
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg border overflow-hidden bg-muted">
                    <img
                      src={img.preview}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => removeImage(idx)}
                      disabled={isExtractingPhoto}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground text-center px-1">
                      {images.length === 0 ? 'Add photo' : 'Add more'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={isExtractingPhoto}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Add one or more photos — e.g. ingredients page and method page (max {MAX_IMAGES}).
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExtractingPhoto || isSwapping}>
                Cancel
              </Button>
              <Button
                onClick={handlePhotoSubmit}
                disabled={images.length === 0 || isExtractingPhoto || isSwapping}
              >
                {isExtractingPhoto || isSwapping ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isExtractingPhoto ? `Extracting from ${images.length} photo${images.length === 1 ? '' : 's'}…` : 'Saving...'}
                  </>
                ) : (
                  mealId ? 'Replace Meal' : 'Add Meal'
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
