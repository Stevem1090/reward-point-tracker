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

function MoneyInput({ value, onSave, placeholder, label, autoFocus, onDone }: { value: number | null; onSave: (v: number | null) => void; placeholder: string; label?: string; autoFocus?: boolean; onDone?: () => void }) {
  const [v, setV] = useState(value?.toString() ?? '');
  useEffect(() => setV(value?.toString() ?? ''), [value]);
  return (
    <Input
      inputMode="decimal" value={v} placeholder={placeholder} aria-label={label ?? placeholder} autoFocus={autoFocus}
      onFocus={(e) => e.target.select()}
      className="h-8 px-1.5 text-sm text-right"
      onChange={(e) => setV(e.target.value)}
      onBlur={(e) => {
        const n = num(v); if (n !== value) onSave(n);
        const next = e.relatedTarget as HTMLElement | null;
        if (!next?.closest('[data-edit-group]')) onDone?.();
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

const COLS = 'grid grid-cols-[minmax(0,1fr)_5.5rem_4.5rem_1.75rem] items-center gap-1.5';
const tapCls = 'w-full min-h-[36px] text-right text-sm rounded px-1 active:bg-muted';

function EstimateCell({ item, update }: { item: CommittedItem; update: (p: Partial<CommittedItem>) => void }) {
  const [edit, setEdit] = useState(false);
  const hasEst = item.estimate_min != null || item.estimate_max != null;
  if (!edit)
    return (
      <button type="button" className={cn(tapCls, !hasEst && 'text-muted-foreground')} onClick={() => setEdit(true)} aria-label={`Edit estimate for ${item.name}`}>
        {hasEst ? (item.is_range ? formatRange({ min: item.estimate_min ?? 0, max: item.estimate_max ?? item.estimate_min ?? 0 }) : formatGBP(item.estimate_min ?? 0)) : '–'}
      </button>
    );
  const toggle = () => update({ is_range: !item.is_range, estimate_max: item.is_range ? null : item.estimate_max ?? item.estimate_min });
  const done = () => setEdit(false);
  return (
    <div data-edit-group className="flex flex-col gap-1 py-1">
      {item.is_range ? (
        <>
          <MoneyInput autoFocus value={item.estimate_min} placeholder="Low" onSave={(v) => update({ estimate_min: v })} onDone={done} />
          <MoneyInput value={item.estimate_max} placeholder="High" onSave={(v) => update({ estimate_max: v })} onDone={done} />
        </>
      ) : (
        <MoneyInput autoFocus value={item.estimate_min} placeholder="Estimate" label="Estimate" onSave={(v) => update({ estimate_min: v })} onDone={done} />
      )}
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={toggle} className="text-[10px] font-medium text-primary text-right leading-none py-1">
        {item.is_range ? 'Single' : '↔ Range'}
      </button>
    </div>
  );
}

function SpentCell({ item, update }: { item: CommittedItem; update: (p: Partial<CommittedItem>) => void }) {
  const [edit, setEdit] = useState(false);
  if (edit)
    return <div data-edit-group><MoneyInput autoFocus value={item.actual_amount} placeholder="Spent" label="Spent" onSave={(v) => update({ actual_amount: v })} onDone={() => setEdit(false)} /></div>;
  const paid = item.actual_amount != null;
  return (
    <button type="button" onClick={() => setEdit(true)} aria-label={`Edit spent for ${item.name}`}
      className={cn(tapCls, paid ? 'text-primary font-medium' : 'text-muted-foreground text-xs')}>
      {paid ? <>{formatGBP(item.actual_amount!)} <Check className="inline h-3 w-3" /></> : '+ Paid'}
    </button>
  );
}

function LineRow({ item, update, remove, name }: {
  item: CommittedItem; update: (p: Partial<CommittedItem>) => void; remove?: () => void; name?: string;
}) {
  const [sel, setSel] = useState(false);
  return (
    <div className={cn(COLS, 'py-0.5')}>
      <button type="button" className="min-w-0 text-left text-sm leading-tight break-words min-h-[36px]" onClick={() => setSel((s) => !s)}>
        {name ?? ''}
      </button>
      <EstimateCell item={item} update={update} />
      <SpentCell item={item} update={update} />
      {remove && sel ? (
        <button type="button" className="h-9 w-7 flex items-center justify-center text-destructive" aria-label={`Remove ${name ?? item.name}`} onClick={remove}>
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
        {tops.map((top) => (
          <CommitmentCard key={top.id} top={top} items={items}
            update={update} remove={remove} addSub={(n) => add(n, top.id)} />
        ))}
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

function CommitmentCard({ top, items, update, remove, addSub }: {
  top: CommittedItem; items: CommittedItem[];
  update: (id: string, p: Partial<CommittedItem>) => void; remove: (id: string) => void; addSub: (name: string) => void;
}) {
  const [sel, setSel] = useState(false);
  const kids = items.filter((c) => c.parent_id === top.id);
  const g = groupTotals(top, items);
  const hasEst = g.estimate.max > 0;
  return (
    <div className={cn('rounded-lg border bg-card px-2.5 py-1', top.is_complete && 'bg-muted/40')}>
      <div className="flex items-center gap-1">
        <button type="button" className="flex-1 min-w-0 text-left min-h-[36px]" onClick={() => setSel((s) => !s)}>
          <span className="font-semibold text-sm break-words leading-tight">{top.name}</span>
          {(g.actual > 0 || hasEst) && (
            <span className="block text-xs text-muted-foreground">
              Spent {formatGBP(g.actual)}{hasEst && <> / Est {formatRange(g.estimate)}</>}
              {!top.is_complete && hasEst && (
                g.actual > g.estimate.max
                  ? <span className="text-destructive font-medium"> · Over {formatGBP(g.actual - g.estimate.max)}</span>
                  : <span className="text-primary"> · Left {formatRange(g.left)}</span>
              )}
            </span>
          )}
        </button>
        <button
          type="button"
          className={cn('shrink-0 rounded-full border px-2.5 min-h-[28px] text-[11px] font-medium inline-flex items-center gap-1',
            top.is_complete ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground')}
          onClick={() => update(top.id, { is_complete: !top.is_complete })}
          aria-pressed={top.is_complete}
        >
          {top.is_complete ? <><Check className="h-3 w-3" /> Done</> : 'Open'}
        </button>
        {sel && (
          <button type="button" className="h-9 w-8 flex items-center justify-center shrink-0 text-destructive" aria-label={`Remove ${top.name}`} onClick={() => remove(top.id)}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {!top.is_complete && (
        <>
          {sel && kids.length > 0 && (
            <div className="flex items-center justify-end gap-2 pb-1 text-xs text-muted-foreground">
              <span>Overall budget</span>
              <div className="w-[5.5rem]"><EstimateCell item={top} update={(p) => update(top.id, p)} /></div>
            </div>
          )}
          <div className={cn(COLS, 'border-b text-[10px] uppercase tracking-wide text-muted-foreground')}>
            <span>Item</span><span className="text-right">Estimate</span><span className="text-right">Spent</span><span />
          </div>
          {kids.length === 0 ? (
            <LineRow item={top} update={(p) => update(top.id, p)} />
          ) : (
            <div className="divide-y">
              {kids.map((k) => (
                <LineRow key={k.id} name={k.name} item={k} update={(p) => update(k.id, p)} remove={() => remove(k.id)} />
              ))}
            </div>
          )}
          <InlineAdd small label="Sub-line" onAdd={addSub} />
        </>
      )}
    </div>
  );
}
