import { useShoppingList } from '@/hooks/useShoppingList';
import { useMealPlans } from '@/hooks/useMealPlans';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { SHOPPING_CATEGORIES, ShoppingListItem } from '@/types/meal';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface ShoppingListViewProps {
  weekStartDate: string;
}

export function ShoppingListView({ weekStartDate }: ShoppingListViewProps) {
  const { useMealPlanForWeek } = useMealPlans();
  const { data: mealPlan, isLoading: planLoading } = useMealPlanForWeek(weekStartDate);
  
  const { 
    shoppingList, 
    groupedItems, 
    isLoading: listLoading, 
    toggleItem, 
    clearChecked 
  } = useShoppingList(mealPlan?.id || null);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const isLoading = planLoading || listLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No approved plan
  if (!mealPlan || mealPlan.status !== 'approved') {
    return (
      <Card className="border-dashed">
        <CardHeader className="text-center">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <CardTitle className="text-xl">No shopping list yet</CardTitle>
          <CardDescription>
            Approve a meal plan to generate your shopping list
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // No shopping list generated yet
  if (!shoppingList || shoppingList.items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="text-center">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <CardTitle className="text-xl">Shopping list is empty</CardTitle>
          <CardDescription>
            Your shopping list will appear here after the meal plan is processed
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const checkedCount = shoppingList.items.filter(i => i.checked).length;
  const totalCount = shoppingList.items.length;

  return (
    <div className="space-y-4">
      {/* Header with progress and clear button */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-medium">
            {checkedCount} of {totalCount} items
          </span>
          <div className="h-2 w-32 bg-muted rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(checkedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
        
        {checkedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearChecked.mutate()}
            disabled={clearChecked.isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear Checked
          </Button>
        )}
      </div>

      {/* Categorized items */}
      <div className="space-y-2">
        {SHOPPING_CATEGORIES.map(category => {
          const items = groupedItems[category];
          if (!items || items.length === 0) return null;
          
          const isOpen = openCategories[category] !== false; // Default to open
          const categoryCheckedCount = items.filter(i => i.checked).length;

          return (
            <Collapsible
              key={category}
              open={isOpen}
              onOpenChange={() => toggleCategory(category)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{category}</CardTitle>
                        <span className="text-sm text-muted-foreground">
                          ({categoryCheckedCount}/{items.length})
                        </span>
                      </div>
                      <ChevronDown className={cn(
                        "h-5 w-5 transition-transform",
                        isOpen && "rotate-180"
                      )} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="py-0 px-0">
                    <div className="divide-y">
                      {items.map((item) => (
                        <ShoppingItemRow
                          key={item.id}
                          item={item}
                          onToggle={(checked) => toggleItem.mutate({ itemId: item.id, checked })}
                        />
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {/* Add item button */}
      <Button variant="outline" className="w-full gap-2 min-h-[48px]">
        <Plus className="h-5 w-5" />
        Add Item
      </Button>
    </div>
  );
}

interface ShoppingItemRowProps {
  item: ShoppingListItem;
  onToggle: (checked: boolean) => void;
}

function ShoppingItemRow({ item, onToggle }: ShoppingItemRowProps) {
  return (
    <label 
      className={cn(
        "flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors min-h-[52px]",
        item.checked && "bg-muted/20"
      )}
    >
      <Checkbox
        checked={item.checked}
        onCheckedChange={onToggle}
        className="h-6 w-6"
      />
      <div className={cn(
        "flex-1 flex items-center justify-between",
        item.checked && "text-muted-foreground line-through"
      )}>
        <span className="font-medium">{item.name}</span>
        <span className="text-sm text-muted-foreground">
          {item.quantity} {item.unit}
        </span>
      </div>
    </label>
  );
}
