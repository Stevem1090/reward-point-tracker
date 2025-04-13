
import React from 'react';
import { RewardProvider } from '@/contexts/RewardContext';
import RewardTracker from '@/components/RewardTracker';
import CategoryManager from '@/components/CategoryManager';
import DailySummary from '@/components/DailySummary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Award, BarChart3 } from 'lucide-react';

const RewardsPage = () => {
  return (
    <RewardProvider>
      <div className="container mx-auto max-w-4xl p-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 bg-gradient-to-r from-kid-purple via-kid-pink to-kid-blue bg-clip-text text-transparent">
          Reward Point Tracker
        </h1>
        <p className="text-center mb-8 text-muted-foreground">Earn stars and track your rewards!</p>
        
        <Tabs defaultValue="track" className="kid-card bg-white/80 backdrop-blur-sm p-4">
          <TabsList className="grid w-full grid-cols-3 rounded-xl bg-soft-purple p-1 mb-2">
            <TabsTrigger value="track" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-kid-purple">
              <Star className="mr-2 h-4 w-4" />
              Track Points
            </TabsTrigger>
            <TabsTrigger value="categories" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-kid-purple">
              <Award className="mr-2 h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="summary" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-kid-purple">
              <BarChart3 className="mr-2 h-4 w-4" />
              Summary
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="track" className="mt-6">
            <RewardTracker />
          </TabsContent>
          
          <TabsContent value="categories" className="mt-6">
            <CategoryManager />
          </TabsContent>
          
          <TabsContent value="summary" className="mt-6">
            <DailySummary />
          </TabsContent>
        </Tabs>
      </div>
    </RewardProvider>
  );
};

export default RewardsPage;
