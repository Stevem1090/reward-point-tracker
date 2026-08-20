import { useState, useMemo } from 'react';
import { useBills } from '@/hooks/useBills';
import { useIncomes } from '@/hooks/useIncomes';
import { calculatePayPeriodTotal } from '@/utils/billCalculations';
import { exportSummaryToCsv, exportSummaryToPdf } from '@/utils/billExport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronLeft, ChevronRight, ChevronDown, Download } from 'lucide-react';

export const MonthlySummary = () => {
  const { bills } = useBills();
  const { incomes } = useIncomes();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate next month by default (next pay period)
  const displayDate = useMemo(() => {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() + 1);
    return date;
  }, [currentDate]);

  const summary = useMemo(() => {
    return calculatePayPeriodTotal(
      bills,
      displayDate.getFullYear(),
      displayDate.getMonth(),
      incomes
    );
  }, [bills, incomes, displayDate]);

  const { grandTotal, startDate, endDate, incomeTotal, difference, accountBreakdowns } = summary;

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

  const monthName = displayDate.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  const periodRange = `${startDate.toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
  })} - ${endDate.toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
  })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Monthly Summary</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[140px] md:min-w-[200px] text-center">
            <div className="font-medium text-sm md:text-base">{monthName}</div>
            <div className="text-xs text-muted-foreground">{periodRange}</div>
          </div>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportSummaryToCsv(summary, displayDate)}>
                Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportSummaryToPdf(summary, displayDate)}>
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <p className="text-sm text-muted-foreground">{monthName} pay period</p>
          <CardTitle className="text-3xl">£{grandTotal.toFixed(2)}</CardTitle>
          <p className="text-sm text-muted-foreground">Total outgoings across all accounts</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t text-center">
            <div>
              <p className="text-xs text-muted-foreground">Income</p>
              <p className="font-semibold">£{incomeTotal.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outgoings</p>
              <p className="font-semibold">£{grandTotal.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {difference >= 0 ? 'Left over' : 'Shortfall'}
              </p>
              <p
                className={`font-semibold ${
                  difference >= 0 ? 'text-emerald-600' : 'text-destructive'
                }`}
              >
                £{Math.abs(difference).toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {accountBreakdowns.map((account) => {
        const percentage = grandTotal > 0 ? Math.round((account.total / grandTotal) * 100) : 0;

        return (
          <Card key={account.accountId || 'unassigned'}>
            <Collapsible>
              <CollapsibleTrigger className="w-full text-left group">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: account.accountColor }}
                      />
                      <CardTitle className="text-base md:text-lg break-words">
                        {account.accountName}
                      </CardTitle>
                    </div>
                    <p className="text-lg font-bold shrink-0">
                      £{account.total.toFixed(2)}{' '}
                      <span className="text-muted-foreground text-sm">({percentage}%)</span>
                    </p>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-5">
                    {account.typeBreakdowns.map((type) => (
                      <div key={type.typeId || 'uncategorised'}>
                        <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: type.typeColor }}
                            />
                            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground break-words">
                              {type.typeName}
                            </p>
                          </div>
                          <p className="text-sm font-semibold shrink-0">
                            £{type.total.toFixed(2)}{' '}
                            <span className="text-muted-foreground font-normal">
                              ({grandTotal > 0 ? Math.round((type.total / grandTotal) * 100) : 0}%)
                            </span>
                          </p>
                        </div>
                        <div className="space-y-3 pl-4">
                          {type.calculations.map((calc) => (
                            <div
                              key={calc.bill.id}
                              className="flex items-start justify-between gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium break-words">{calc.bill.name}</p>
                                {calc.paymentCount > 1 && (
                                  <p className="text-xs text-muted-foreground">
                                    {calc.paymentCount} payments × £
                                    {calc.individualAmount.toFixed(2)}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-semibold">£{calc.totalAmount.toFixed(2)}</p>
                                {calc.paymentCount === 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Not due this period
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {accountBreakdowns.length === 0 && (
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
