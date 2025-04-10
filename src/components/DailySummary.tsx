
import React from 'react';
import { useReward } from '@/contexts/RewardContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, Send, Star, Mail } from 'lucide-react';

const DailySummary = () => {
  const { getDailySummary, sendSummary, contactInfo } = useReward();
  const summary = getDailySummary();

  const handleSendEmail = () => {
    sendSummary('email');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between">
            <span>Daily Points Summary</span>
            <span className="text-2xl">{summary.totalPoints} points</span>
          </CardTitle>
          <CardDescription>Summary for {summary.date}</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.entriesByCategory.length === 0 ? (
            <div className="text-center py-8">
              <Star className="mx-auto h-12 w-12 text-gray-300 mb-2" />
              <p className="text-gray-500">No points recorded today</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.entriesByCategory.map(category => (
                  <TableRow key={category.categoryId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{category.categoryName}</p>
                        <p className="text-sm text-gray-500">
                          {category.entries.length} {category.entries.length === 1 ? 'entry' : 'entries'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {category.totalPoints}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-1">
              <Award className="h-5 w-5 text-amber-500" />
              <span className="text-lg font-semibold">Grand Total:</span>
            </div>
            <span className="text-xl font-bold">{summary.totalPoints} points</span>
          </div>
          
          <Button 
            onClick={handleSendEmail} 
            className="w-full"
            disabled={!contactInfo.email || summary.entriesByCategory.length === 0}
          >
            <Mail className="mr-2 h-4 w-4" />
            Send via Email
          </Button>
          
          {!contactInfo.email && (
            <p className="text-sm text-center text-muted-foreground">
              Email address not set. Please add your email in the Settings tab.
            </p>
          )}
        </CardFooter>
      </Card>
      
      {summary.entriesByCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Entries</CardTitle>
            <CardDescription>All point entries for today</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.entriesByCategory.map(category => (
              <div key={category.categoryId} className="mb-6">
                <h3 className="text-lg font-semibold mb-2">{category.categoryName}</h3>
                <div className="space-y-2">
                  {category.entries.map(entry => (
                    <div key={entry.id} className="flex justify-between items-start border-b pb-2">
                      <div>
                        <p>{entry.description || category.categoryName}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(entry.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <span className={`font-semibold ${entry.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.points >= 0 ? '+' : ''}{entry.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailySummary;
