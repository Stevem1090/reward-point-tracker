
import React, { useState } from 'react';
import { useReward } from '@/contexts/RewardContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Star, ThumbsUp, ThumbsDown, Award } from 'lucide-react';

const RewardTracker = () => {
  const { categories, addEntry, entries } = useReward();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [pointValue, setPointValue] = useState<number | null>(null);
  const [description, setDescription] = useState('');

  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    const category = categories.find(cat => cat.id === categoryId);
    if (category) {
      setPointValue(category.pointValue);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCategoryId) return;
    
    // Use the point value directly (can be positive or negative)
    const finalPoints = pointValue || selectedCategory?.pointValue || 0;
    
    addEntry({
      categoryId: selectedCategoryId,
      description,
      points: finalPoints
    });
    
    // Reset form
    setDescription('');
  };

  // Filter only today's entries
  const todayEntries = entries.filter(entry => {
    const entryDate = new Date(entry.timestamp);
    const today = new Date();
    return entryDate.getDate() === today.getDate() &&
           entryDate.getMonth() === today.getMonth() &&
           entryDate.getFullYear() === today.getFullYear();
  });

  // Sort entries by most recent first
  const sortedEntries = [...todayEntries].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getTotalPoints = () => {
    return sortedEntries.reduce((total, entry) => total + entry.points, 0);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Record Points</CardTitle>
          <CardDescription>Track reward points for achievements or behavior</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={selectedCategoryId} onValueChange={handleCategoryChange}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name} ({category.pointValue > 0 ? '+' : ''}{category.pointValue} points)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add details about this entry..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="points">Points</Label>
              <div className="flex space-x-2">
                <Input
                  id="points"
                  type="number"
                  value={pointValue !== null ? pointValue : selectedCategory?.pointValue || ''}
                  onChange={e => setPointValue(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="flex-1"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Enter positive values for rewards or negative values for deductions
              </p>
            </div>

            <Button type="submit" disabled={!selectedCategoryId} className="w-full">
              <Star className="mr-2 h-4 w-4" />
              Record Points
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Today's Points</span>
            <span className="text-2xl font-bold">{getTotalPoints()}</span>
          </CardTitle>
          <CardDescription>Recent point entries</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px] pr-4">
            {sortedEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No points recorded today
              </div>
            ) : (
              <div className="space-y-4">
                {sortedEntries.map(entry => {
                  const category = categories.find(cat => cat.id === entry.categoryId);
                  return (
                    <div key={entry.id} className="flex items-start gap-2 p-3 border rounded-lg">
                      <div className={`p-2 rounded-full ${entry.points >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                        {entry.points >= 0 ? (
                          <ThumbsUp className="h-5 w-5 text-green-600" />
                        ) : (
                          <ThumbsDown className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{category?.name}</p>
                        {entry.description && (
                          <p className="text-sm text-gray-500">{entry.description}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className={`font-bold ${entry.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.points >= 0 ? '+' : ''}{entry.points}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="flex items-center gap-1">
            <Award className="h-5 w-5 text-amber-500" />
            <span className="text-lg font-semibold">Total:</span>
          </div>
          <span className="text-xl font-bold">{getTotalPoints()} points</span>
        </CardFooter>
      </Card>
    </div>
  );
};

export default RewardTracker;
