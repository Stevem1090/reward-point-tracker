import { useState } from 'react';
import { Bill } from '@/types/bill';
import { useBills } from '@/hooks/useBills';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Edit2, Trash2, Plus, Search } from 'lucide-react';
import { BillForm } from './BillForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const BillList = () => {
  const { bills, loading, createBill, updateBill, deleteBill, toggleBillActive } =
    useBills();
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = async (
    data: Omit<Bill, 'id' | 'created_at' | 'updated_at' | 'bill_type'>
  ) => {
    if (editingBill) {
      await updateBill(editingBill.id, data);
      setEditingBill(null);
    } else {
      await createBill(data);
      setIsAdding(false);
    }
  };

  const getFrequencyBadge = (bill: Bill) => {
    const frequencyColors: Record<string, string> = {
      daily: 'bg-blue-100 text-blue-800',
      weekly: 'bg-green-100 text-green-800',
      monthly: 'bg-purple-100 text-purple-800',
      yearly: 'bg-orange-100 text-orange-800',
      'one-time': 'bg-pink-100 text-pink-800',
    };

    const frequencyLabels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly',
      'one-time': 'One-Time',
    };

    return (
      <span className={`text-[10px] md:text-xs px-2 py-1 rounded-full ${frequencyColors[bill.frequency] || 'bg-gray-100 text-gray-800'}`}>
        {frequencyLabels[bill.frequency] || bill.frequency}
      </span>
    );
  };

  const getFrequencyDisplay = (bill: Bill): string => {
    switch (bill.frequency) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return `Weekly (${bill.weekly_days?.join(', ')})`;
      case 'monthly':
        const day = bill.payment_day || 1;
        return day === 1 ? 'Monthly (1st of month)' : `Monthly (${day}th of month)`;
      case 'yearly':
        return bill.payment_date
          ? `Yearly (${new Date(bill.payment_date).toLocaleDateString()})`
          : 'Yearly';
      case 'one-time':
        return bill.payment_date
          ? `One-Time (${new Date(bill.payment_date).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })})`
          : 'One-Time';
      default:
        return bill.frequency;
    }
  };

  if (loading) return <div>Loading...</div>;

  if (isAdding || editingBill) {
    return (
      <BillForm
        bill={editingBill || undefined}
        onSubmit={handleSubmit}
        onCancel={() => {
          setIsAdding(false);
          setEditingBill(null);
        }}
      />
    );
  }

  const filteredBills = bills.filter((bill) => {
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = bill.name.toLowerCase().includes(searchLower);
    const typeMatch = bill.bill_type?.name.toLowerCase().includes(searchLower);
    return nameMatch || typeMatch;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <h3 className="text-base md:text-lg font-semibold">Bills</h3>
        <Button onClick={() => setIsAdding(true)} size="sm" className="shrink-0">
          <Plus className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Add Bill</span>
        </Button>
      </div>

      {bills.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search bills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {bills.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No bills yet. Add your first bill to get started.
            </p>
          </CardContent>
        </Card>
      ) : filteredBills.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No bills found matching "{searchQuery}". Try a different search term.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredBills.map((bill) => (
            <Card key={bill.id} className={!bill.active ? 'opacity-50' : ''}>
              <CardContent className="pt-4 pb-4 px-4">
                <div className="space-y-3">
                  {/* Row 1: Title + Switch */}
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-semibold text-base break-words flex-1 min-w-0">
                      {bill.name}
                    </h4>
                    <Switch
                      checked={bill.active}
                      onCheckedChange={(checked) =>
                        toggleBillActive(bill.id, checked)
                      }
                      className="shrink-0"
                    />
                  </div>

                  {/* Row 2: Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {getFrequencyBadge(bill)}
                    {bill.bill_type && (
                      <Badge
                        className="text-[10px] md:text-xs"
                        style={{
                          backgroundColor: bill.bill_type.color,
                          color: 'white',
                        }}
                      >
                        {bill.bill_type.name}
                      </Badge>
                    )}
                  </div>

                  {/* Row 3: Amount */}
                  <p className="text-2xl md:text-3xl font-bold">
                    £{bill.amount.toFixed(2)}
                  </p>

                  {/* Row 4: Description */}
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {getFrequencyDisplay(bill)}
                  </p>

                  {/* Row 5: Action buttons */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingBill(bill)}
                      className="flex-1"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteId(bill.id)}
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this bill? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteBill(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
