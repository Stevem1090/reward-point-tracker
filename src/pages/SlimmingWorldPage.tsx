import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DailyTracker } from '@/components/slimming-world/DailyTracker';
import { FoodLibrary } from '@/components/slimming-world/FoodLibrary';
import { MealLibrary } from '@/components/slimming-world/MealLibrary';

export default function SlimmingWorldPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl overflow-x-hidden">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Slimming World</h1>
        <p className="text-muted-foreground text-sm">Track your daily Swips and Healthy Extras</p>
      </div>

      <Tabs defaultValue="today" className="w-full min-w-0">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="foods">Foods</TabsTrigger>
          <TabsTrigger value="meals">Meals</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4"><DailyTracker /></TabsContent>
        <TabsContent value="foods" className="mt-4"><FoodLibrary /></TabsContent>
        <TabsContent value="meals" className="mt-4"><MealLibrary /></TabsContent>
      </Tabs>
    </div>
  );
}
