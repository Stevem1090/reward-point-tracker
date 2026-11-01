import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Settings } from 'lucide-react';
import { BillList } from '@/components/bills/BillList';
import { MonthlySummary } from '@/components/bills/MonthlySummary';
import { BillTypeManager } from '@/components/bills/BillTypeManager';
import { BillAccountManager } from '@/components/bills/BillAccountManager';
import { IncomeManager } from '@/components/bills/IncomeManager';
import { CommittedSpending } from '@/components/bills/CommittedSpending';

export default function BillsPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('accounts');

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl min-w-0">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-1">Bill Tracker</h1>
          <p className="text-muted-foreground">Manage your bills, income and monthly spending</p>
        </div>
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Accounts and types" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <Tabs defaultValue="bills" className="w-full">
        <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
          <TabsList className="inline-flex w-max min-w-full justify-start gap-1 rounded-full h-11 p-1">
            {[['bills', 'Bills'], ['committed', 'Committed'], ['income', 'Income'], ['summary', 'Summary']].map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="flex-1 rounded-full px-4 min-h-[36px]">{l}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="bills" className="mt-6"><BillList /></TabsContent>
        <TabsContent value="committed" className="mt-6"><CommittedSpending /></TabsContent>
        <TabsContent value="income" className="mt-6"><IncomeManager /></TabsContent>
        <TabsContent value="summary" className="mt-6"><MonthlySummary /></TabsContent>
      </Tabs>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Accounts & types</SheetTitle></SheetHeader>
          <Tabs value={settingsTab} onValueChange={setSettingsTab} className="mt-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="types">Types</TabsTrigger>
            </TabsList>
            <TabsContent value="accounts" className="mt-4"><BillAccountManager /></TabsContent>
            <TabsContent value="types" className="mt-4"><BillTypeManager /></TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
