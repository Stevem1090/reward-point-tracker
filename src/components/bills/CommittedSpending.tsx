import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBillAccounts } from '@/hooks/useBillAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, Trash2, ArrowLeftRight, CheckCircle2, Circle } from 'lucide-react';
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

function MoneyInput({ value, onSave, placeholder, disabled }: { value: number | null; onSave: (v: number | null) => void; placeholder: string; disabled?: boolean }) {
  const [v, setV] = useState(value?.toString() ?? '');
  useEffect(() => setV(value?.toString() ?? ''), [value]);
  return (
    <div className="relative w-20 shrink-0">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span>
      <Input
        inputMode="decimal" value={v} placeholder={placeholder} disabled={disabled}
        className="h-10 pl-5 pr-1 text-sm"
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { const n = num(v); if (n !== value) onSave(n); }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </div>
  );
}

function LineRow({ item, update, remove, showEstimate = true, locked }: {
  item: CommittedItem; update: (p: Partial<CommittedItem>) => void; remove: () => void; showEstimate?: boolean; locked?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      <span className="flex-1 min-w-[6rem] truncate text-sm">{item.name}</span>
      {showEstimate && (
        <div className="flex items-center gap-1">
          <MoneyInput value={item.estimate_min} placeholder={item.is_range ? 'Low' : 'Est.'} onSave={(v) => update({ estimate_min: v })} disabled={locked} />
          {item.is_range && (<><span className="text-muted-foreground text-xs">–</span>
            <MoneyInput value={item.estimate_max} placeholder="High" onSave={(v) => update({ estimate_max: v })} disabled={locked} /></>)}
          <Button
            variant={item.is_range ? 'secondary' : 'ghost'} size="icon" className="h-10 w-10" disabled={locked}
            aria-label={item.is_range ? 'Use single amount' : 'Use a range'} title={item.is_range ? 'Single amount' : 'Range'}
            onClick={() => update({ is_range: !item.is_range, estimate_max: item.is_range ? null : item.estimate_max ?? item.estimate_min })}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      <MoneyInput value={item.actual_amount} placeholder="Spent" onSave={(v) => update({ actual_amount: v })} />
      <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" aria-label="Delete" onClick={remove}>
        <Trash2 className="h-4 w-4" />
      </Button>
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
            <div key={top.id} className={cn('rounded-lg border bg-card p-3', top.is_complete && 'opacity-70')}>
              <div className="flex items-center gap-2">
                <span className="font-semibold flex-1 truncate">{top.name}</span>
                <Button
                  variant={top.is_complete ? 'secondary' : 'outline'} size="sm" className="min-h-[40px] shrink-0"
                  onClick={() => update(top.id, { is_complete: !top.is_complete })}
                >
                  {top.is_complete ? <CheckCircle2 className="h-4 w-4 mr-1 text-primary" /> : <Circle className="h-4 w-4 mr-1" />}
                  {top.is_complete ? 'Spending complete' : 'No more spend'}
                </Button>
              </div>

              {kids.length === 0 ? (
                <LineRow item={top} update={(p) => update(top.id, p)} remove={() => remove(top.id)} />
              ) : (
                <>
                  <div className="pl-3 border-l mt-2 space-y-0.5">
                    {kids.map((k) => (
                      <LineRow key={k.id} item={k} update={(p) => update(k.id, p)} remove={() => remove(k.id)} />
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => remove(top.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove group
                    </Button>
                  </div>
                </>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-1 text-xs text-muted-foreground">
                <span>Est. {formatRange(g.estimate)} · Spent {formatGBP(g.actual)} · Left {formatRange(g.left)}</span>
                <InlineAdd small label="Add sub-line" onAdd={(n) => add(n, top.id)} />
              </div>
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
