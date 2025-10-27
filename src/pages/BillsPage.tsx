import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BillList } from '@/components/bills/BillList';
import { MonthlySummary } from '@/components/bills/MonthlySummary';
import { BillTypeManager } from '@/components/bills/BillTypeManager';

export default function BillsPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Bill Tracker</h1>
        <p className="text-muted-foreground">
          Manage your bills and track monthly expenses
        </p>
      </div>

      <Tabs defaultValue="bills" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="summary">Monthly Summary</TabsTrigger>
          <TabsTrigger value="types">Bill Types</TabsTrigger>
        </TabsList>

        <TabsContent value="bills" className="mt-6">
          <BillList />
        </TabsContent>

        <TabsContent value="summary" className="mt-6">
          <MonthlySummary />
        </TabsContent>

        <TabsContent value="types" className="mt-6">
          <BillTypeManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
