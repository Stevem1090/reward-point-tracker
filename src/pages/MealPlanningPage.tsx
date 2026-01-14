import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WeekSelector } from '@/components/meals/WeekSelector';
import { MealPlanView } from '@/components/meals/MealPlanView';
import { ShoppingListView } from '@/components/meals/ShoppingListView';
import { RecipeLibrary } from '@/components/meals/RecipeLibrary';
import { MealPlanHistory } from '@/components/meals/MealPlanHistory';
import { getWeekStartDate } from '@/utils/getWeekBounds';
import { addWeeks } from 'date-fns';

export default function MealPlanningPage() {
  const [selectedWeek, setSelectedWeek] = useState<'this' | 'next'>('this');
  
  const weekStartDate = selectedWeek === 'this' 
    ? getWeekStartDate() 
    : getWeekStartDate(addWeeks(new Date(), 1));

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Meal Planning</h1>
        <p className="text-muted-foreground">
          Plan your family meals for the week
        </p>
      </div>

      <Tabs defaultValue="plan" className="w-full">
        <TabsList className="grid w-full grid-cols-4 text-xs md:text-sm">
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="shopping">Shopping</TabsTrigger>
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-6 space-y-4">
          <WeekSelector 
            selectedWeek={selectedWeek} 
            onWeekChange={setSelectedWeek} 
          />
          <MealPlanView weekStartDate={weekStartDate} />
        </TabsContent>

        <TabsContent value="shopping" className="mt-6">
          <ShoppingListView weekStartDate={weekStartDate} />
        </TabsContent>

        <TabsContent value="recipes" className="mt-6">
          <RecipeLibrary />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <MealPlanHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
