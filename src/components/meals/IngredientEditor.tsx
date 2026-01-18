import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { Ingredient } from '@/types/meal';

const COMMON_UNITS = [
  '', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb',
  'pinch', 'bunch', 'clove', 'slice', 'piece', 'can', 'pack'
];

interface IngredientEditorProps {
  ingredients: Ingredient[];
  onChange: (ingredients: Ingredient[]) => void;
}

export function IngredientEditor({ ingredients, onChange }: IngredientEditorProps) {
  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addIngredient = () => {
    onChange([...ingredients, { quantity: '', unit: '', name: '' }]);
  };

  const removeIngredient = (index: number) => {
    onChange(ingredients.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[60px_80px_1fr_32px] gap-1.5 text-xs text-muted-foreground font-medium px-1">
        <span>Qty</span>
        <span>Unit</span>
        <span>Ingredient</span>
        <span></span>
      </div>
      
      {ingredients.map((ingredient, index) => (
        <div key={index} className="grid grid-cols-[60px_80px_1fr_32px] gap-1.5 items-center">
          <Input
            value={ingredient.quantity}
            onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
            placeholder="1"
            className="h-9 text-sm"
          />
          <Select
            value={ingredient.unit || ''}
            onValueChange={(value) => updateIngredient(index, 'unit', value)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="-" />
            </SelectTrigger>
            <SelectContent>
              {COMMON_UNITS.map((unit) => (
                <SelectItem key={unit || 'none'} value={unit || ' '}>
                  {unit || '(none)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={ingredient.name}
            onChange={(e) => updateIngredient(index, 'name', e.target.value)}
            placeholder="Ingredient name"
            className="h-9 text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => removeIngredient(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 mt-2"
        onClick={addIngredient}
      >
        <Plus className="h-4 w-4" />
        Add Ingredient
      </Button>
    </div>
  );
}
