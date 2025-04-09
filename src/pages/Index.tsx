
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RewardProvider } from '@/contexts/RewardContext';
import RewardTracker from '@/components/RewardTracker';
import CategoryManager from '@/components/CategoryManager';
import DailySummary from '@/components/DailySummary';
import Settings from '@/components/Settings';

const Index = () => {
  return (
    <RewardProvider>
      <div className="container mx-auto max-w-4xl p-4">
        <h1 className="text-3xl font-bold text-center mb-8">Reward Point Tracker</h1>
        
        <Tabs defaultValue="track">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="track">Track Points</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
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
          
          <TabsContent value="settings" className="mt-6">
            <Settings />
          </TabsContent>
        </Tabs>
      </div>
    </RewardProvider>
  );
};

export default Index;
