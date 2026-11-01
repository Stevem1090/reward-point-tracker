import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBillAccounts } from '@/hooks/useBillAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, X, Check } from 'lucide-react';
import {
  CommittedItem, currentPayPeriodKey, formatGBP, formatRange, groupTotals,
  periodLabel, periodTotals, shiftPeriod,
} from '@/utils/committedSpending';

const table = () => (supabase as any).from('committed_spending_items');
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/[£,]/g, '')) || 0);

function InlineAdd({ label, onAdd, small }: { label: string; onAdd: (name: string) => void; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState('');
  if (!open)
    return (
      <Button variant="ghost" size={small ? 'sm' : 'default'} className="text-muted-foreground min-h-[44px]" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> {label}
      </Button>
    );
  const commit = () => { if (v.trim()) onAdd(v.trim()); setV(''); setOpen(false); };
  return (
    <Input
      autoFocus value={v} placeholder="Type a name and press Enter" className="min-h-[44px]"
      onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setV(''); setOpen(false); } }}
    />
  );
}

function MoneyInput({ value, onSave, placeholder, disabled, label }: { value: number | null; onSave: (v: number | null) => void; placeholder: string; disabled?: boolean; label?: string }) {
  const [v, setV] = useState(value?.toString() ?? '');
  useEffect(() => setV(value?.toString() ?? ''), [value]);
  return (
    <div className="relative min-w-0 flex-1">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
      <Input
        inputMode="decimal" value={v} placeholder={placeholder} disabled={disabled} aria-label={label ?? placeholder}
        className="h-11 pl-7 pr-2 text-base"
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { const n = num(v); if (n !== value) onSave(n); }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </div>
  );
}

function LineRow({ item, update, remove, locked, sub }: {
  item: CommittedItem; update: (p: Partial<CommittedItem>) => void; remove: () => void; locked?: boolean; sub?: boolean;
}) {
  return (
    <div className={cn('py-2', sub && 'border-t first:border-t-0')}>
      {sub && (
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-medium truncate min-w-0">{item.name}</span>
          <Button variant="ghost" size="icon" className="h-11 w-11 -mr-2 shrink-0 text-muted-foreground" aria-label={`Remove ${item.name}`} onClick={remove}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <div className="flex items-center justify-between h-6 mb-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimate</span>
            <button
              type="button" disabled={locked}
              className="text-[11px] font-medium text-primary px-1 min-h-[24px] disabled:opacity-50"
              onClick={() => update({ is_range: !item.is_range, estimate_max: item.is_range ? null : item.estimate_max ?? item.estimate_min })}
            >
              {item.is_range ? 'Single' : 'Range'}
            </button>
          </div>
          {item.is_range ? (
            <div className="flex items-center gap-1">
              <MoneyInput value={item.estimate_min} placeholder="Low" onSave={(v) => update({ estimate_min: v })} disabled={locked} />
              <span className="text-muted-foreground text-xs">–</span>
              <MoneyInput value={item.estimate_max} placeholder="High" onSave={(v) => update({ estimate_max: v })} disabled={locked} />
            </div>
          ) : (
            <MoneyInput value={item.estimate_min} placeholder="0" label="Estimate" onSave={(v) => update({ estimate_min: v })} disabled={locked} />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center h-6 mb-1"><span className="text-[11px] uppercase tracking-wide text-muted-foreground">Spent</span></div>
          <MoneyInput value={item.actual_amount} placeholder="0" label="Spent" onSave={(v) => update({ actual_amount: v })} />
        </div>
      </div>
    </div>
  );
}

export function CommittedSpending() {
  const { accounts } = useBillAccounts();
  const [period, setPeriod] = useState(currentPayPeriodKey());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [items, setItems] = useState<CommittedItem[]>([]);

  useEffect(() => { if (!accountId && accounts.length) setAccountId(accounts[0].id); }, [accounts, accountId]);

  const load = useCallback(async () => {
    if (!accountId) return;
    const { data, error } = await table().select('*').eq('pay_period', period).eq('account_id', accountId).order('sort_order').order('created_at');
    if (error) toast.error('Failed to load committed spending');
    setItems((data as CommittedItem[]) || []);
  }, [period, accountId]);
  useEffect(() => { load(); }, [load]);

  const add = async (name: string, parent_id: string | null = null) => {
    const { data, error } = await table().insert({ name, parent_id, pay_period: period, account_id: accountId, sort_order: items.length }).select().single();
    if (error) return toast.error('Could not add item');
    setItems((p) => [...p, data as CommittedItem]);
  };
  const update = async (id: string, patch: Partial<CommittedItem>) => {
    setItems((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const { error } = await table().update(patch).eq('id', id);
    if (error) { toast.error('Could not save'); load(); }
  };
  const remove = async (id: string) => {
    setItems((p) => p.filter((i) => i.id !== id && i.parent_id !== id));
    const { error } = await table().delete().eq('id', id);
    if (error) { toast.error('Could not delete'); load(); }
  };

  const tops = items.filter((i) => !i.parent_id);
  const totals = useMemo(() => periodTotals(items), [items]);

  if (!accounts.length)
    return <p className="text-sm text-muted-foreground">Add an account first (cog icon above) to start tracking committed spending.</p>;

  return (
    <div className="pb-32 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Previous month" onClick={() => setPeriod(shiftPeriod(period, -1))}><ChevronLeft /></Button>
        <span className="font-medium">{periodLabel(period)}</span>
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Next month" onClick={() => setPeriod(shiftPeriod(period, 1))}><ChevronRight /></Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
        {accounts.map((a) => (
          <Button key={a.id} size="sm" variant={a.id === accountId ? 'default' : 'outline'} className="rounded-full shrink-0 min-h-[40px]" onClick={() => setAccountId(a.id)}>
            {a.name}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {tops.map((top) => {
          const kids = items.filter((c) => c.parent_id === top.id);
          const g = groupTotals(top, items);
          return (
            <div key={top.id} className={cn('rounded-xl border bg-card px-3 pt-2 pb-1', top.is_complete && 'bg-muted/40')}>
              <div className="flex items-center gap-1">
                <span className="font-semibold flex-1 min-w-0 truncate">{top.name}</span>
                <button
                  type="button"
                  className={cn('shrink-0 rounded-full border px-3 min-h-[32px] text-xs font-medium inline-flex items-center gap-1',
                    top.is_complete ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground')}
                  onClick={() => update(top.id, { is_complete: !top.is_complete })}
                  aria-pressed={top.is_complete}
                >
                  {top.is_complete ? <><Check className="h-3.5 w-3.5" /> Done</> : 'Open'}
                </button>
                <Button variant="ghost" size="icon" className="h-11 w-11 -mr-2 shrink-0 text-muted-foreground" aria-label={`Remove ${top.name}`} onClick={() => remove(top.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {kids.length === 0 ? (
                <LineRow item={top} update={(p) => update(top.id, p)} remove={() => remove(top.id)} />
              ) : (
                <div className="mt-1 rounded-lg bg-muted/40 px-3">
                  {kids.map((k) => (
                    <LineRow sub key={k.id} item={k} update={(p) => update(k.id, p)} remove={() => remove(k.id)} />
                  ))}
                </div>
              )}
              {(kids.length > 0 || g.actual > 0 || top.estimate_min != null) && (
                <div className="grid grid-cols-3 gap-1 text-center text-[11px] text-muted-foreground mt-2 pt-2 border-t">
                  <div><div>Est.</div><div className="text-sm font-medium text-foreground">{formatRange(g.estimate)}</div></div>
                  <div><div>Spent</div><div className="text-sm font-medium text-foreground">{formatGBP(g.actual)}</div></div>
                  <div><div>Left</div><div className="text-sm font-medium text-primary">{formatRange(g.left)}</div></div>
                </div>
              )}
              <InlineAdd small label="Add sub-line" onAdd={(n) => add(n, top.id)} />
            </div>
          );
        })}
        <InlineAdd label="Add commitment" onAdd={(n) => add(n)} />
      </div>

      <div className="fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-2 text-center">
          <div><div className="text-[11px] text-muted-foreground">Estimated</div><div className="font-semibold text-sm">{formatRange(totals.estimate)}</div></div>
          <div><div className="text-[11px] text-muted-foreground">Spent</div><div className="font-semibold text-sm">{formatGBP(totals.actual)}</div></div>
          <div><div className="text-[11px] text-muted-foreground">Left to spend</div><div className="font-semibold text-sm text-primary">{formatRange(totals.left)}</div></div>
        </div>
      </div>
    </div>
  );
}
