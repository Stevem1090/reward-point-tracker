import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { VINTED_REFERENCE as ref } from '@/vinted/reference';
import { CATEGORY_TYPES, loadRules, saveRules, type PricingRule } from '@/vinted/pricing';

const ANY = '__any';
const brands = ref.brands.main as Record<string, string>;
const selectCls = 'h-11 w-full rounded-md border border-input bg-background px-2 text-sm';

export default function VintedPricingRules() {
  const [rules, setRules] = useState<PricingRule[]>(loadRules);
  const update = (id: string, patch: Partial<PricingRule>) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const save = () => {
    if (rules.some((r) => !(r.price > 0))) { toast('Every price must be more than £0'); return; }
    if (!rules.some((r) => !r.categoryType && r.brandId == null)) { toast('Keep one fallback rule (any category, any brand)'); return; }
    saveRules(rules);
    toast('Pricing rules saved');
  };

  return (
    <div className="container mx-auto max-w-2xl px-3 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11"><Link to="/profile" aria-label="Back"><ArrowLeft /></Link></Button>
        <h1 className="text-xl font-bold">Vinted pricing rules</h1>
      </div>
      <p className="text-sm text-muted-foreground">Default prices the AI starts from. The most specific match wins (category and brand, then category, then brand, then fallback). The AI may move a price £1 up or down for condition. You always confirm the final price.</p>

      {rules.map((r) => {
        const fallback = !r.categoryType && r.brandId == null;
        return (
          <Card key={r.id}>
            <CardContent className="p-3 grid grid-cols-[1fr_1fr_5rem_auto] gap-2 items-center">
              <select aria-label="Category" className={selectCls} value={r.categoryType ?? ANY} onChange={(e) => update(r.id, { categoryType: e.target.value === ANY ? null : e.target.value })}>
                <option value={ANY}>Any category</option>
                {CATEGORY_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select aria-label="Brand" className={selectCls} value={r.brandId ?? ANY} onChange={(e) => update(r.id, { brandId: e.target.value === ANY ? null : Number(e.target.value) })}>
                <option value={ANY}>Any brand</option>
                {Object.entries(brands).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
              <Input aria-label="Price £" className="h-11" inputMode="decimal" value={String(r.price)} onChange={(e) => update(r.id, { price: Number(e.target.value) || 0 })} />
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Delete rule" onClick={() => setRules((rs) => rs.filter((x) => x.id !== r.id))}><Trash2 className="h-4 w-4" /></Button>
              {fallback && <span className="col-span-4 text-xs text-muted-foreground">Fallback: used when nothing else matches.</span>}
            </CardContent>
          </Card>
        );
      })}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11" onClick={() => setRules((rs) => [...rs, { id: crypto.randomUUID(), categoryType: CATEGORY_TYPES[0], brandId: null, price: 4 }])}><Plus className="mr-1 h-4 w-4" />Add rule</Button>
        <Button className="h-11" onClick={save}>Save rules</Button>
      </div>
    </div>
  );
}
