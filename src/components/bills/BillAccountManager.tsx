import { useState } from 'react';
import { useBillAccounts } from '@/hooks/useBillAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, Edit2, X } from 'lucide-react';
import { AccountKind } from '@/types/bill';
import { getAccountBalanceSigned, getNetPosition } from '@/utils/financialSnapshot';

const KIND_LABELS: Record<AccountKind, string> = {
  current: 'Current account',
  savings: 'Savings',
  credit_card: 'Credit card',
};

const emptyForm = {
  name: '',
  color: '#6366f1',
  sort_order: 0,
  account_kind: 'current' as AccountKind,
  current_balance: 0,
  credit_limit: '' as string | number,
  apr: '' as string | number,
  promo_end_date: '',
};

export const BillAccountManager = () => {
  const { accounts, loading, createAccount, updateAccount, deleteAccount } =
    useBillAccounts();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const reset = () => {
    setFormData(emptyForm);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCard = formData.account_kind === 'credit_card';
    const payload = {
      name: formData.name,
      color: formData.color,
      sort_order: formData.sort_order,
      account_kind: formData.account_kind,
      current_balance: Number(formData.current_balance) || 0,
      credit_limit: isCard && formData.credit_limit !== '' ? Number(formData.credit_limit) : null,
      apr: isCard && formData.apr !== '' ? Number(formData.apr) : null,
      promo_end_date: isCard && formData.promo_end_date ? formData.promo_end_date : null,
    };

    if (editingId) {
      await updateAccount(editingId, payload);
    } else {
      await createAccount(payload);
    }
    reset();
  };

  const netPosition = getNetPosition(accounts);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Where the money goes, e.g. Bills Account, Groceries
          </p>
        </div>
        {!isAdding && !editingId && (
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        )}
      </div>

      {(isAdding || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? 'Edit Account' : 'New Account'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="account_name">Name</Label>
                <Input
                  id="account_name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="account_color">Colour</Label>
                <Input
                  id="account_color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-10 w-20 p-1"
                />
              </div>
              <div>
                <Label htmlFor="account_kind">Account type</Label>
                <Select
                  value={formData.account_kind}
                  onValueChange={(value) =>
                    setFormData({ ...formData, account_kind: value as AccountKind })
                  }
                >
                  <SelectTrigger id="account_kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current account</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="credit_card">Credit card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="account_balance">
                  {formData.account_kind === 'credit_card'
                    ? 'Balance owed (£)'
                    : 'Current balance (£)'}
                </Label>
                <Input
                  id="account_balance"
                  type="number"
                  step="0.01"
                  value={formData.current_balance}
                  onChange={(e) =>
                    setFormData({ ...formData, current_balance: e.target.value as unknown as number })
                  }
                />
                {formData.account_kind === 'credit_card' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Entered as a positive number, counted as money owed.
                  </p>
                )}
              </div>
              {formData.account_kind === 'credit_card' && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="account_limit">Credit limit (£)</Label>
                    <Input
                      id="account_limit"
                      type="number"
                      step="0.01"
                      value={formData.credit_limit}
                      onChange={(e) =>
                        setFormData({ ...formData, credit_limit: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="account_apr">Interest rate (% APR)</Label>
                    <Input
                      id="account_apr"
                      type="number"
                      step="0.01"
                      value={formData.apr}
                      onChange={(e) => setFormData({ ...formData, apr: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="account_promo">0% promo ends</Label>
                    <Input
                      id="account_promo"
                      type="date"
                      value={formData.promo_end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, promo_end_date: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="account_order">Sort order</Label>
                <Input
                  id="account_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })
                  }
                />
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

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No accounts yet. Add one to group your bills by where the money goes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Net position</p>
                <p className="text-xs text-muted-foreground">Cash minus credit card balances</p>
              </div>
              <p
                className={`text-xl font-bold ${
                  netPosition >= 0 ? 'text-emerald-600' : 'text-destructive'
                }`}
              >
                {netPosition < 0 ? '-' : ''}£{Math.abs(netPosition).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {accounts.map((account) => {
              const signed = getAccountBalanceSigned(account);
              return (
            <Card key={account.id}>
              <CardContent className="py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: account.color || '#6366f1' }}
                  />
                  <div className="min-w-0">
                    <span className="font-medium break-words">{account.name}</span>
                    <p className="text-xs text-muted-foreground">
                      {KIND_LABELS[account.account_kind] || 'Current account'}
                      {account.account_kind === 'credit_card' && account.apr
                        ? ` · ${account.apr}% APR`
                        : ''}
                      {account.account_kind === 'credit_card' && account.promo_end_date
                        ? ` · 0% until ${new Date(account.promo_end_date).toLocaleDateString('en-GB', {
                            month: 'short',
                            year: 'numeric',
                          })}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-semibold ${
                      signed < 0 ? 'text-destructive' : ''
                    }`}
                  >
                    {signed < 0 ? '-' : ''}£{Math.abs(signed).toFixed(2)}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      setEditingId(account.id);
                      setIsAdding(false);
                      setFormData({
                        name: account.name,
                        color: account.color || '#6366f1',
                        sort_order: account.sort_order,
                        account_kind: account.account_kind || 'current',
                        current_balance: Number(account.current_balance || 0),
                        credit_limit: account.credit_limit ?? '',
                        apr: account.apr ?? '',
                        promo_end_date: account.promo_end_date ?? '',
                      });
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => deleteAccount(account.id)}
                  >
                    <Trash2 className="h-4 w-4" />
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
