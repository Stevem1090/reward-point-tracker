import { useState } from 'react';
import { Bill } from '@/types/bill';
import { useBills } from '@/hooks/useBills';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Edit2, Trash2, Plus } from 'lucide-react';
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
      <span className={`text-xs px-2 py-1 rounded-full ${frequencyColors[bill.frequency] || 'bg-gray-100 text-gray-800'}`}>
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Bills</h3>
        <Button onClick={() => setIsAdding(true)} size="sm" className="shrink-0">
          <Plus className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Add Bill</span>
        </Button>
      </div>

      {bills.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No bills yet. Add your first bill to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {bills.map((bill) => (
            <Card key={bill.id} className={!bill.active ? 'opacity-50' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{bill.name}</h4>
                      {getFrequencyBadge(bill)}
                      {bill.bill_type && (
                        <Badge
                          style={{
                            backgroundColor: bill.bill_type.color,
                            color: 'white',
                          }}
                        >
                          {bill.bill_type.name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold">
                      £{bill.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getFrequencyDisplay(bill)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={bill.active}
                      onCheckedChange={(checked) =>
                        toggleBillActive(bill.id, checked)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingBill(bill)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(bill.id)}
                    >
                      <Trash2 className="h-4 w-4" />
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
