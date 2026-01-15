import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Globe, BookOpen, Clock, Users, ChevronLeft } from 'lucide-react';
import { useDirectRecipeExtraction, ExtractedRecipe } from '@/hooks/useDirectRecipeExtraction';
import { useRecipes } from '@/hooks/useRecipes';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'website' | 'cookbook';
}

type DialogState = 'input' | 'preview' | 'saving';

export function AddRecipeDialog({ open, onOpenChange, defaultTab = 'website' }: AddRecipeDialogProps) {
  const [activeTab, setActiveTab] = useState<'website' | 'cookbook'>(defaultTab);
  const [dialogState, setDialogState] = useState<DialogState>('input');
  
  // Website tab state
  const [url, setUrl] = useState('');
  
  // Cookbook tab state
  const [recipeText, setRecipeText] = useState('');
  const [cookbookTitle, setCookbookTitle] = useState('');
  const [recipeName, setRecipeName] = useState('');
  
  // Preview state
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedServings, setEditedServings] = useState(4);
  const [editedCookTime, setEditedCookTime] = useState<number | undefined>();

  const { extractFromUrl, processCookbook } = useDirectRecipeExtraction();
  const { createRecipe } = useRecipes();

  const resetForm = () => {
    setUrl('');
    setRecipeText('');
    setCookbookTitle('');
    setRecipeName('');
    setExtractedRecipe(null);
    setEditedName('');
    setEditedDescription('');
    setEditedServings(4);
    setEditedCookTime(undefined);
    setDialogState('input');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
      setActiveTab(defaultTab);
    }
    onOpenChange(newOpen);
  };

  const handleExtractFromUrl = async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    try {
      const recipe = await extractFromUrl.mutateAsync({ url: url.trim() });
      setExtractedRecipe(recipe);
      setEditedName(recipe.name);
      setEditedDescription(recipe.description || '');
      setEditedServings(recipe.servings);
      setEditedCookTime(recipe.estimated_cook_minutes);
      setDialogState('preview');
    } catch {
      // Error handled in hook
    }
  };

  const handleProcessCookbook = async () => {
    if (!recipeText.trim()) {
      toast.error('Please enter the recipe text');
      return;
    }

    try {
      const recipe = await processCookbook.mutateAsync({
        recipeText: recipeText.trim(),
        cookbookTitle: cookbookTitle.trim() || undefined,
        recipeName: recipeName.trim() || undefined
      });
      setExtractedRecipe(recipe);
      setEditedName(recipe.name);
      setEditedDescription(recipe.description || '');
      setEditedServings(recipe.servings);
      setEditedCookTime(recipe.estimated_cook_minutes);
      setDialogState('preview');
    } catch {
      // Error handled in hook
    }
  };

  const handleSaveToLibrary = async () => {
    if (!extractedRecipe) return;

    setDialogState('saving');

    try {
      await createRecipe.mutateAsync({
        name: editedName,
        description: editedDescription || null,
        servings: editedServings,
        estimated_cook_minutes: editedCookTime || null,
        ingredients: extractedRecipe.ingredients,
        steps: extractedRecipe.steps,
        image_url: extractedRecipe.image_url || null,
        recipe_url: extractedRecipe.source_url || null,
        source_type: activeTab === 'website' ? 'website' : 'cookbook',
        cookbook_title: activeTab === 'cookbook' ? cookbookTitle || null : null
      });

      toast.success('Recipe saved to library!');
      handleOpenChange(false);
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Failed to save recipe');
      setDialogState('preview');
    }
  };

  const isExtracting = extractFromUrl.isPending || processCookbook.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {dialogState === 'input' && 'Add Recipe to Library'}
            {dialogState === 'preview' && 'Review Recipe'}
            {dialogState === 'saving' && 'Saving...'}
          </DialogTitle>
        </DialogHeader>

        {dialogState === 'input' && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'website' | 'cookbook')} className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="website" className="gap-2">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">From Website</span>
                <span className="sm:hidden">Website</span>
              </TabsTrigger>
              <TabsTrigger value="cookbook" className="gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">From Cookbook</span>
                <span className="sm:hidden">Cookbook</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="website" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="recipe-url">Recipe URL</Label>
                <Input
                  id="recipe-url"
                  type="url"
                  placeholder="https://example.com/recipe..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isExtracting}
                />
                <p className="text-xs text-muted-foreground">
                  Paste the URL of a recipe page. We'll extract the ingredients and steps automatically.
                </p>
              </div>

              <Button 
                onClick={handleExtractFromUrl} 
                disabled={isExtracting || !url.trim()}
                className="w-full min-h-[44px]"
              >
                {extractFromUrl.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting Recipe...
                  </>
                ) : (
                  'Extract Recipe'
                )}
              </Button>
            </TabsContent>

            <TabsContent value="cookbook" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="cookbook-title">Cookbook Title (optional)</Label>
                <Input
                  id="cookbook-title"
                  placeholder="e.g., The Joy of Cooking"
                  value={cookbookTitle}
                  onChange={(e) => setCookbookTitle(e.target.value)}
                  disabled={isExtracting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipe-name">Recipe Name (optional)</Label>
                <Input
                  id="recipe-name"
                  placeholder="e.g., Chicken Tikka Masala"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  disabled={isExtracting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipe-text">Recipe Text</Label>
                <Textarea
                  id="recipe-text"
                  placeholder="Paste the recipe text from your cookbook or photo..."
                  value={recipeText}
                  onChange={(e) => setRecipeText(e.target.value)}
                  disabled={isExtracting}
                  className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  Copy text from a photo using your phone's OCR feature, or type the recipe manually.
                </p>
              </div>

              <Button 
                onClick={handleProcessCookbook} 
                disabled={isExtracting || !recipeText.trim()}
                className="w-full min-h-[44px]"
              >
                {processCookbook.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing Recipe...
                  </>
                ) : (
                  'Process Recipe'
                )}
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {dialogState === 'preview' && extractedRecipe && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogState('input')}
              className="self-start -ml-2"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 pb-4">
                {/* Editable fields */}
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Recipe Name</Label>
                  <Input
                    id="edit-name"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description (optional)</Label>
                  <Textarea
                    id="edit-description"
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-servings">Servings</Label>
                    <Input
                      id="edit-servings"
                      type="number"
                      min={1}
                      value={editedServings}
                      onChange={(e) => setEditedServings(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-cooktime">Cook Time (mins)</Label>
                    <Input
                      id="edit-cooktime"
                      type="number"
                      min={0}
                      value={editedCookTime || ''}
                      onChange={(e) => setEditedCookTime(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </div>
                </div>

                {/* Preview of extracted data */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {extractedRecipe.servings} servings
                    </span>
                    {extractedRecipe.estimated_cook_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {extractedRecipe.estimated_cook_minutes} mins
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-2">Ingredients ({extractedRecipe.ingredients.length})</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 max-h-[100px] overflow-y-auto">
                      {extractedRecipe.ingredients.slice(0, 5).map((ing, i) => (
                        <li key={i}>• {ing.quantity} {ing.unit} {ing.name}</li>
                      ))}
                      {extractedRecipe.ingredients.length > 5 && (
                        <li className="text-xs">... and {extractedRecipe.ingredients.length - 5} more</li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-2">Steps ({extractedRecipe.steps.length})</h4>
                    <ol className="text-sm text-muted-foreground space-y-1 max-h-[100px] overflow-y-auto list-decimal list-inside">
                      {extractedRecipe.steps.slice(0, 3).map((step, i) => (
                        <li key={i} className="truncate">{step}</li>
                      ))}
                      {extractedRecipe.steps.length > 3 && (
                        <li className="text-xs list-none">... and {extractedRecipe.steps.length - 3} more steps</li>
                      )}
                    </ol>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <Button 
              onClick={handleSaveToLibrary}
              disabled={!editedName.trim()}
              className="w-full min-h-[44px]"
            >
              Save to Library
            </Button>
          </div>
        )}

        {dialogState === 'saving' && (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
