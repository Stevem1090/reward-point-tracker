import { useState, useEffect } from 'react';
import { Bill, BillFrequency } from '@/types/bill';
import { useBillTypes } from '@/hooks/useBillTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';

interface BillFormProps {
  bill?: Bill;
  onSubmit: (data: Omit<Bill, 'id' | 'created_at' | 'updated_at' | 'bill_type'>) => Promise<void>;
  onCancel: () => void;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const BillForm = ({ bill, onSubmit, onCancel }: BillFormProps) => {
  const { billTypes } = useBillTypes();
  const [formData, setFormData] = useState({
    name: bill?.name || '',
    amount: bill?.amount || 0,
    bill_type_id: bill?.bill_type_id || null,
    frequency: (bill?.frequency || 'monthly') as BillFrequency,
    payment_day: bill?.payment_day || null,
    payment_date: bill?.payment_date || null,
    weekly_days: bill?.weekly_days || [],
    active: bill?.active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate one-time bills have a payment date
    if (formData.frequency === 'one-time' && !formData.payment_date) {
      alert('One-time bills require a payment date');
      return;
    }
    
    await onSubmit(formData as any);
  };

  const toggleWeekday = (day: string) => {
    const current = formData.weekly_days || [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    setFormData({ ...formData, weekly_days: updated });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{bill ? 'Edit Bill' : 'New Bill'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Bill Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="amount">Amount (£)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: parseFloat(e.target.value) })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="bill_type">Bill Type (optional)</Label>
            <Select
              value={formData.bill_type_id || undefined}
              onValueChange={(value) =>
                setFormData({ ...formData, bill_type_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {billTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Frequency</Label>
            <RadioGroup
              value={formData.frequency}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  frequency: value as BillFrequency,
                  payment_day: value === 'monthly' ? 1 : null,
                  payment_date: null,
                  weekly_days: [],
                })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="daily" id="daily" />
                <Label htmlFor="daily">Daily</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="weekly" id="weekly" />
                <Label htmlFor="weekly">Weekly</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="monthly" id="monthly" />
                <Label htmlFor="monthly">Monthly</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yearly" id="yearly" />
                <Label htmlFor="yearly">Yearly</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="one-time" id="one-time" />
                <Label htmlFor="one-time">One-Time</Label>
              </div>
            </RadioGroup>
          </div>

          {formData.frequency === 'weekly' && (
            <div>
              <Label>Days of Week</Label>
              <div className="space-y-2 mt-2">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={day}
                      checked={formData.weekly_days?.includes(day)}
                      onCheckedChange={() => toggleWeekday(day)}
                    />
                    <Label htmlFor={day}>{day}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.frequency === 'monthly' && (
            <div>
              <Label htmlFor="payment_day">Day of Month (optional)</Label>
              <Input
                id="payment_day"
                type="number"
                min="1"
                max="31"
                value={formData.payment_day || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payment_day: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Defaults to 1st"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Leave blank to automatically use the 1st of each month
              </p>
            </div>
          )}

          {formData.frequency === 'one-time' && (
            <div>
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date || ''}
                onChange={(e) =>
                  setFormData({ ...formData, payment_date: e.target.value })
                }
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                Select the specific date for this one-time expense
              </p>
            </div>
          )}

          {formData.frequency === 'yearly' && (
            <div>
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date || ''}
                onChange={(e) =>
                  setFormData({ ...formData, payment_date: e.target.value })
                }
                required
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit">{bill ? 'Update' : 'Create'} Bill</Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
