import { useState } from 'react';
import { useIncomes } from '@/hooks/useIncomes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Edit2, X } from 'lucide-react';

export const IncomeManager = () => {
  const { incomes, loading, createIncome, updateIncome, deleteIncome } = useIncomes();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: 0,
    active: true,
    expiry_date: null as string | null,
  });

  const reset = () => {
    setFormData({ name: '', amount: 0, active: true, expiry_date: null });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateIncome(editingId, formData);
    } else {
      await createIncome(formData);
    }
    reset();
  };

  const activeTotal = incomes
    .filter((income) => income.active)
    .reduce((sum, income) => sum + Number(income.amount || 0), 0);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Income</h3>
          <p className="text-sm text-muted-foreground">
            Monthly amounts, e.g. "Steve's Salary"
          </p>
        </div>
        {!isAdding && !editingId && (
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">£{activeTotal.toFixed(2)}</CardTitle>
          <p className="text-sm text-muted-foreground">Total monthly income</p>
        </CardHeader>
      </Card>

      {(isAdding || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? 'Edit Income' : 'New Income'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="income_name">Name</Label>
                <Input
                  id="income_name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="income_amount">Monthly amount (£)</Label>
                <Input
                  id="income_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="income_expiry">Stops after (optional)</Label>
                <Input
                  id="income_expiry"
                  type="date"
                  value={formData.expiry_date || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, expiry_date: e.target.value || null })
                  }
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label>Active</Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingId ? 'Update' : 'Create'}</Button>
                <Button type="button" variant="outline" onClick={reset}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {incomes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No income entries yet. Add one to compare money in vs money out.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {incomes.map((income) => (
            <Card key={income.id} className={!income.active ? 'opacity-50' : ''}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{income.name}</p>
                    <p className="text-2xl font-bold">£{Number(income.amount).toFixed(2)}</p>
                    {income.expiry_date && (
                      <p className="text-xs text-muted-foreground">
                        Ends {new Date(income.expiry_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={income.active}
                    onCheckedChange={(checked) => updateIncome(income.id, { active: checked })}
                  />
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setEditingId(income.id);
                      setIsAdding(false);
                      setFormData({
                        name: income.name,
                        amount: Number(income.amount),
                        active: income.active,
                        expiry_date: income.expiry_date || null,
                      });
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => deleteIncome(income.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
