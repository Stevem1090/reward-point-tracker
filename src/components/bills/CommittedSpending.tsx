import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBillAccounts } from '@/hooks/useBillAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
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
      <Button variant="ghost" size={small ? 'sm' : 'default'} className={cn('text-muted-foreground', small ? 'h-8 px-1 text-xs' : 'min-h-[44px]')} onClick={() => setOpen(true)}>
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
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span>
      <Input
        inputMode="decimal" value={v} placeholder={placeholder} disabled={disabled} aria-label={label ?? placeholder}
        className="h-9 pl-4 pr-1 text-sm text-right"
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { const n = num(v); if (n !== value) onSave(n); }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </div>
  );
}

const COLS = 'grid grid-cols-[minmax(0,1fr)_5.5rem_4.5rem_2rem] items-center gap-1.5';

function LineRow({ item, update, remove, locked, name, spentTotal }: {
  item: CommittedItem; update: (p: Partial<CommittedItem>) => void; remove?: () => void; locked?: boolean; name?: string; spentTotal?: number;
}) {
  const toggle = () => update({ is_range: !item.is_range, estimate_max: item.is_range ? null : item.estimate_max ?? item.estimate_min });
  return (
    <div className={cn(COLS, 'py-1')}>
      <div className="min-w-0">
        {name && <div className="text-sm leading-tight break-words">{name}</div>}
        <button type="button" disabled={locked} onClick={toggle}
          className="text-[10px] font-medium text-primary disabled:opacity-50 leading-none py-1">
          {item.is_range ? 'Single' : '↔ Range'}
        </button>
      </div>
      {item.is_range ? (
        <div className="flex flex-col gap-1">
          <MoneyInput value={item.estimate_min} placeholder="Low" onSave={(v) => update({ estimate_min: v })} disabled={locked} />
          <MoneyInput value={item.estimate_max} placeholder="High" onSave={(v) => update({ estimate_max: v })} disabled={locked} />
        </div>
      ) : (
        <MoneyInput value={item.estimate_min} placeholder="–" label="Estimate" onSave={(v) => update({ estimate_min: v })} disabled={locked} />
      )}
      {spentTotal !== undefined ? (
        <span className="text-sm text-right pr-1 text-muted-foreground">{formatGBP(spentTotal)}</span>
      ) : (
        <MoneyInput value={item.actual_amount} placeholder="0" label="Spent" onSave={(v) => update({ actual_amount: v })} />
      )}
      {remove ? (
        <button type="button" className="h-9 w-8 flex items-center justify-center text-muted-foreground" aria-label={`Remove ${name ?? item.name}`} onClick={remove}>
          <X className="h-4 w-4" />
        </button>
      ) : <span />}
    </div>
  );
}

function AccountPicker({ label, options, onPick }: { label: string; options: { id: string; name: string }[]; onPick: (id: string) => void }) {
  return (
    <Select value="" onValueChange={onPick}>
      <SelectTrigger className="rounded-full shrink-0 h-9 w-auto gap-1 border-dashed text-sm" aria-label={label}>
        <Plus className="h-4 w-4" /><span>{label}</span>
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">All accounts already in use</div>
        ) : options.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function CommittedSpending() {
  const { accounts } = useBillAccounts();
  const [period, setPeriod] = useState(currentPayPeriodKey());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<CommittedItem[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await table().select('*').eq('pay_period', period).order('sort_order').order('created_at');
    if (error) toast.error('Failed to load committed spending');
    setAllItems((data as CommittedItem[]) || []);
  }, [period]);
  useEffect(() => { load(); }, [load]);

  const usedIds = useMemo(() => new Set(allItems.map((i) => i.account_id)), [allItems]);
  const activeAccounts = accounts.filter((a) => usedIds.has(a.id) || a.id === accountId);
  const unusedAccounts = accounts.filter((a) => !usedIds.has(a.id) && a.id !== accountId);

  // Keep a valid selection: prefer an account that has items this month.
  useEffect(() => {
    if (accountId && accounts.some((a) => a.id === accountId)) return;
    const first = accounts.find((a) => usedIds.has(a.id));
    setAccountId(first ? first.id : null);
  }, [accounts, usedIds, accountId]);
  useEffect(() => { setAccountId(null); }, [period]);

  const items = allItems.filter((i) => i.account_id === accountId);

  const add = async (name: string, parent_id: string | null = null) => {
    const { data, error } = await table().insert({ name, parent_id, pay_period: period, account_id: accountId, sort_order: items.length }).select().single();
    if (error) return toast.error('Could not add item');
    setAllItems((p) => [...p, data as CommittedItem]);
  };
  const update = async (id: string, patch: Partial<CommittedItem>) => {
    setAllItems((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const { error } = await table().update(patch).eq('id', id);
    if (error) { toast.error('Could not save'); load(); }
  };
  const remove = async (id: string) => {
    setAllItems((p) => p.filter((i) => i.id !== id && i.parent_id !== id));
    const { error } = await table().delete().eq('id', id);
    if (error) { toast.error('Could not delete'); load(); }
  };

  const tops = items.filter((i) => !i.parent_id).sort((a, b) => Number(a.is_complete) - Number(b.is_complete));
  const totals = useMemo(() => periodTotals(items), [items]);

  if (!accounts.length)
    return <p className="text-sm text-muted-foreground">Add an account first (cog icon above) to start tracking committed spending.</p>;

  return (
    <div className="pb-20 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Previous month" onClick={() => setPeriod(shiftPeriod(period, -1))}><ChevronLeft /></Button>
        <span className="font-medium">{periodLabel(period)}</span>
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Next month" onClick={() => setPeriod(shiftPeriod(period, 1))}><ChevronRight /></Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 mb-2 no-scrollbar">
        {activeAccounts.map((a) => (
          <Button key={a.id} size="sm" variant={a.id === accountId ? 'default' : 'outline'} className="rounded-full shrink-0 min-h-[36px] h-9" onClick={() => setAccountId(a.id)}>
            {a.name}
          </Button>
        ))}
        <AccountPicker label={activeAccounts.length ? 'Account' : 'Select account'} options={unusedAccounts} onPick={setAccountId} />
      </div>

      {!accountId ? (
        <p className="text-sm text-muted-foreground px-1 py-6 text-center">Pick an account to start adding commitments for this month.</p>
      ) : (
      <div className="space-y-2">
        {tops.map((top) => {
          const kids = items.filter((c) => c.parent_id === top.id);
          const g = groupTotals(top, items);
          return (
            <div key={top.id} className={cn('rounded-lg border bg-card px-2.5 py-1.5', top.is_complete && 'bg-muted/40')}>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm flex-1 min-w-0 break-words leading-tight">{top.name}</span>
                {top.is_complete && <span className="text-xs text-muted-foreground shrink-0">{formatGBP(g.actual)}</span>}
                <button
                  type="button"
                  className={cn('shrink-0 rounded-full border px-2.5 min-h-[28px] text-[11px] font-medium inline-flex items-center gap-1',
                    top.is_complete ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground')}
                  onClick={() => update(top.id, { is_complete: !top.is_complete })}
                  aria-pressed={top.is_complete}
                >
                  {top.is_complete ? <><Check className="h-3 w-3" /> Done</> : 'Open'}
                </button>
                <button type="button" className="h-9 w-8 flex items-center justify-center shrink-0 text-muted-foreground" aria-label={`Remove ${top.name}`} onClick={() => remove(top.id)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              {!top.is_complete && (
                <>
                  <div className={cn(COLS, 'border-b pb-0.5 mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground')}>
                    <span>Item</span><span className="text-right">Estimate</span><span className="text-right">Spent</span><span />
                  </div>
                  {kids.length === 0 ? (
                    <LineRow item={top} update={(p) => update(top.id, p)} />
                  ) : (
                    <>
                      <LineRow name="Overall budget" item={top} update={(p) => update(top.id, p)} spentTotal={g.actual} />
                      <div className="divide-y border-t">
                        {kids.map((k) => (
                          <LineRow key={k.id} name={k.name} item={k} update={(p) => update(k.id, p)} remove={() => remove(k.id)} />
                        ))}
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <InlineAdd small label="Sub-line" onAdd={(n) => add(n, top.id)} />
                    {kids.length > 0 && (
                      <span className="text-[11px] text-muted-foreground truncate">
                        Est {formatRange(g.estimate)} · Spent {formatGBP(g.actual)} · <span className="text-primary">Left {formatRange(g.left)}</span>
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        <InlineAdd label="Add commitment" onAdd={(n) => add(n)} />
      </div>
      )}

      <div className="fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur px-4 py-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)]">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-2 text-center">
          <div><div className="text-[11px] text-muted-foreground">Estimated</div><div className="font-semibold text-sm">{formatRange(totals.estimate)}</div></div>
          <div><div className="text-[11px] text-muted-foreground">Spent</div><div className="font-semibold text-sm">{formatGBP(totals.actual)}</div></div>
          <div><div className="text-[11px] text-muted-foreground">Left to spend</div><div className="font-semibold text-sm text-primary">{formatRange(totals.left)}</div></div>
        </div>
      </div>
    </div>
  );
}
