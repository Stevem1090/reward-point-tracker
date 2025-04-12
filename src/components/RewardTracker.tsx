
import React, { useState } from 'react';
import { useReward } from '@/contexts/RewardContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Star, ThumbsUp, ThumbsDown, Award, ChevronLeft, ChevronRight, Calendar, BarChart3, CalendarIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isSameDay } from 'date-fns';
import { useWeeklyPoints } from '@/hooks/useWeeklyPoints';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';

const RewardTracker = () => {
  const { 
    categories, 
    addEntry, 
    entries, 
    isLoading, 
    selectedDate, 
    goToPreviousDay, 
    goToNextDay, 
    goToToday 
  } = useReward();
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [pointValue, setPointValue] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [useCustomDate, setUseCustomDate] = useState(false);

  // Use the weekly points hook
  const { weeklyPoints, isLoadingWeekly } = useWeeklyPoints(selectedDate, entries);

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
    }, useCustomDate ? entryDate : undefined);
    
    // Reset form
    setDescription('');
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return isSameDay(date, today);
  };

  // Sort entries by most recent first
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getTotalPoints = () => {
    return sortedEntries.reduce((total, entry) => total + entry.points, 0);
  };

  const getFormattedDate = () => {
    const isCurrentDay = isToday(selectedDate);
    return isCurrentDay ? 'Today' : format(selectedDate, 'EEEE, MMMM d, yyyy');
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
          <CardFooter>
            <Skeleton className="h-6 w-full" />
          </CardFooter>
        </Card>
      </div>
    );
  }

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

            {/* Date Selection for Entry */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="custom-date">Use Custom Date</Label>
                <Switch 
                  id="custom-date" 
                  checked={useCustomDate} 
                  onCheckedChange={setUseCustomDate}
                />
              </div>
              
              {useCustomDate && (
                <div className="mt-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {entryDate ? format(entryDate, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={entryDate}
                        onSelect={(date) => date && setEntryDate(date)}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              
              {useCustomDate && (
                <p className="text-sm text-muted-foreground">
                  Points will be recorded for {format(entryDate, 'MMMM d, yyyy')}
                </p>
              )}
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span>{getFormattedDate()} Points</span>
                <span className="text-2xl font-bold">{getTotalPoints()}</span>
              </div>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button variant="outline" size="sm" onClick={goToToday} disabled={isToday(selectedDate)}>
                <Calendar className="h-4 w-4 mr-1" />
                Today
              </Button>
              
              <Button 
                variant="outline" 
                size="icon" 
                onClick={goToNextDay} 
                disabled={isToday(selectedDate)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription>Point entries for {format(selectedDate, 'MMMM d, yyyy')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px] pr-4">
            {sortedEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No points recorded for this day
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
        <CardFooter className="flex flex-col space-y-4">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-1">
              <Award className="h-5 w-5 text-amber-500" />
              <span className="text-lg font-semibold">Today's Total:</span>
            </div>
            <span className="text-xl font-bold">{getTotalPoints()} points</span>
          </div>
          
          {/* Weekly Points Summary */}
          <div className="border-t pt-4 w-full">
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-1">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <span className="text-lg font-semibold">This Week:</span>
              </div>
              {isLoadingWeekly ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <span className="text-xl font-bold">{weeklyPoints} points</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total points earned from Monday to Sunday
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default RewardTracker;
