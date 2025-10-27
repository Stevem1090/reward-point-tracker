import { useState, useMemo } from 'react';
import { useBills } from '@/hooks/useBills';
import { calculatePayPeriodTotal } from '@/utils/billCalculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const MonthlySummary = () => {
  const { bills } = useBills();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate next month by default (next pay period)
  const displayDate = useMemo(() => {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() + 1);
    return date;
  }, [currentDate]);

  const { calculations, grandTotal, startDate, endDate } = useMemo(() => {
    return calculatePayPeriodTotal(
      bills, 
      displayDate.getFullYear(), 
      displayDate.getMonth()
    );
  }, [bills, displayDate]);

  const groupedByType = useMemo(() => {
    const groups: { [key: string]: typeof calculations } = {};
    
    calculations.forEach((calc) => {
      const typeName = calc.bill.bill_type?.name || 'Uncategorized';
      if (!groups[typeName]) {
        groups[typeName] = [];
      }
      groups[typeName].push(calc);
    });

    return groups;
  }, [calculations]);

  const previousMonth = () => {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() - 1);
    setCurrentDate(date);
  };

  const nextMonth = () => {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() + 1);
    setCurrentDate(date);
  };

  const monthName = displayDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const periodRange = `${startDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  })} - ${endDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Monthly Summary</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[200px] text-center">
            <div className="font-medium">{monthName}</div>
            <div className="text-xs text-muted-foreground">{periodRange}</div>
          </div>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">${grandTotal.toFixed(2)}</CardTitle>
          <p className="text-sm text-muted-foreground">Total bills for {monthName} pay period</p>
        </CardHeader>
      </Card>

      {Object.entries(groupedByType).map(([typeName, typeCalcs]) => {
        const typeTotal = typeCalcs.reduce((sum, calc) => sum + calc.totalAmount, 0);
        const typeColor = typeCalcs[0]?.bill.bill_type?.color || '#6366f1';

        return (
          <Card key={typeName}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: typeColor }}
                  />
                  <CardTitle className="text-lg">{typeName}</CardTitle>
                </div>
                <p className="text-xl font-bold">${typeTotal.toFixed(2)}</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {typeCalcs.map((calc) => (
                  <div
                    key={calc.bill.id}
                    className="flex items-start justify-between pb-3 border-b last:border-0 last:pb-0"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{calc.bill.name}</p>
                      {calc.paymentCount > 1 && (
                        <p className="text-sm text-muted-foreground">
                          {calc.paymentCount} payments × ${calc.individualAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${calc.totalAmount.toFixed(2)}</p>
                      {calc.paymentCount === 0 && (
                        <p className="text-xs text-muted-foreground">Not due this month</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {calculations.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No active bills to display for this month.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
