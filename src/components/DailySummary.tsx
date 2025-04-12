
import React from 'react';
import { useReward } from '@/contexts/RewardContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, Star, Mail, PartyPopper, Trophy, Gem } from 'lucide-react';

const DailySummary = () => {
  const { getDailySummary, sendSummary } = useReward();
  const summary = getDailySummary();

  const handleSendEmail = () => {
    sendSummary('email');
  };

  return (
    <div className="space-y-6">
      <Card className="kid-card border-kid-blue/30 bg-soft-blue">
        <CardHeader className="pb-2">
          <CardTitle className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-kid-yellow animate-bounce-small" />
              <span>Daily Points Summary</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-kid-purple to-kid-blue bg-clip-text text-transparent">
              {summary.totalPoints} points
            </span>
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
                  <TableRow key={category.categoryId} className="hover:bg-white/50">
                    <TableCell>
                      <div>
                        <p className="font-medium">{category.categoryName}</p>
                        <p className="text-sm text-gray-500">
                          {category.entries.length} {category.entries.length === 1 ? 'entry' : 'entries'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      <span className={category.totalPoints >= 0 ? "text-kid-green" : "text-red-500"}>
                        {category.totalPoints}
                      </span>
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
              <PartyPopper className="h-5 w-5 text-kid-orange" />
              <span className="text-lg font-semibold">Grand Total:</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-kid-orange to-kid-yellow bg-clip-text text-transparent">
              {summary.totalPoints} points
            </span>
          </div>
          
          <Button 
            onClick={handleSendEmail} 
            className="w-full kid-button bg-gradient-to-r from-kid-blue to-kid-purple text-white border-0"
            disabled={summary.entriesByCategory.length === 0}
          >
            <Mail className="mr-2 h-4 w-4" />
            Send via Email
          </Button>
        </CardFooter>
      </Card>
      
      {summary.entriesByCategory.length > 0 && (
        <Card className="kid-card border-kid-orange/30 bg-soft-yellow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gem className="h-5 w-5 text-kid-purple animate-spin-slow" />
              Detailed Entries
            </CardTitle>
            <CardDescription>All point entries for today</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.entriesByCategory.map(category => (
              <div key={category.categoryId} className="mb-6">
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                  <Star className="h-4 w-4 text-kid-yellow mr-1" /> 
                  {category.categoryName}
                </h3>
                <div className="space-y-2">
                  {category.entries.map(entry => (
                    <div key={entry.id} className="flex justify-between items-start border-b pb-2 hover:bg-white/50 rounded-lg p-2 transition-colors">
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
