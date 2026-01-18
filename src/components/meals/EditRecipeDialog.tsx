import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Recipe, Ingredient } from '@/types/meal';
import { useRecipes } from '@/hooks/useRecipes';
import { IngredientEditor } from './IngredientEditor';
import { StepsEditor } from './StepsEditor';
import { optimizeImage } from '@/utils/imageOptimization';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Recipe;
}

export function EditRecipeDialog({ open, onOpenChange, recipe }: EditRecipeDialogProps) {
  const { updateRecipe } = useRecipes();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(recipe.name);
  const [description, setDescription] = useState(recipe.description || '');
  const [servings, setServings] = useState(recipe.servings);
  const [cookTime, setCookTime] = useState(recipe.estimated_cook_minutes || 0);
  const [ingredients, setIngredients] = useState<Ingredient[]>(recipe.ingredients);
  const [steps, setSteps] = useState<string[]>(recipe.steps);
  const [imageUrl, setImageUrl] = useState(recipe.image_url || '');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    // Validate file size (10MB max before optimization)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    setPendingImageFile(file);
  };

  const removeImage = () => {
    setImageUrl('');
    setImagePreview(null);
    setPendingImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      // Optimize image before upload
      const optimizedBlob = await optimizeImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.8,
        format: 'jpeg'
      });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const fileName = `${recipe.id}-${Date.now()}.jpg`;
      const filePath = `${user.id}/${fileName}`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('recipe-images')
        .upload(filePath, optimizedBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(filePath);
      
      return publicUrl;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Recipe name is required');
      return;
    }
    
    if (ingredients.length === 0) {
      toast.error('Add at least one ingredient');
      return;
    }
    
    if (steps.length === 0) {
      toast.error('Add at least one step');
      return;
    }
    
    setIsSaving(true);
    try {
      let finalImageUrl = imageUrl;
      
      // Upload new image if pending
      if (pendingImageFile) {
        finalImageUrl = await uploadImage(pendingImageFile);
      }
      
      await updateRecipe.mutateAsync({
        id: recipe.id,
        name: name.trim(),
        description: description.trim() || null,
        servings,
        estimated_cook_minutes: cookTime || null,
        ingredients,
        steps,
        image_url: finalImageUrl || null,
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update recipe:', error);
      toast.error('Failed to save recipe');
    } finally {
      setIsSaving(false);
    }
  };

  const displayImage = imagePreview || imageUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>Edit Recipe</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-120px)] px-4">
          <div className="space-y-4 py-4">
            {/* Image upload */}
            <div className="space-y-2">
              <Label>Recipe Image</Label>
              {displayImage ? (
                <div className="relative">
                  <img
                    src={displayImage}
                    alt="Recipe preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={removeImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload an image
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              {!displayImage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload Image
                </Button>
              )}
            </div>
            
            {/* Recipe name */}
            <div className="space-y-2">
              <Label htmlFor="name">Recipe Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Spaghetti Bolognese"
              />
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of the recipe..."
                rows={2}
              />
            </div>
            
            {/* Servings and cook time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="servings">Servings</Label>
                <Input
                  id="servings"
                  type="number"
                  min={1}
                  value={servings}
                  onChange={(e) => setServings(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cookTime">Cook Time (mins)</Label>
                <Input
                  id="cookTime"
                  type="number"
                  min={0}
                  value={cookTime}
                  onChange={(e) => setCookTime(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            
            {/* Ingredients */}
            <div className="space-y-2">
              <Label>Ingredients *</Label>
              <IngredientEditor
                ingredients={ingredients}
                onChange={setIngredients}
              />
            </div>
            
            {/* Steps */}
            <div className="space-y-2">
              <Label>Steps *</Label>
              <StepsEditor
                steps={steps}
                onChange={setSteps}
              />
            </div>
          </div>
        </ScrollArea>
        
        {/* Footer */}
        <div className="flex gap-2 p-4 pt-2 border-t">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={isSaving || isUploading}
          >
            {isSaving || isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isUploading ? 'Uploading...' : 'Saving...'}
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
