import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useSwFoods } from '@/hooks/useSwFoods';
import { HealthyExtraType, HEALTHY_EXTRA_LABELS, SwFood } from '@/types/slimmingWorld';
import { Sparkles } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  food?: SwFood | null;
}

export function FoodFormDialog({ open, onOpenChange, food }: Props) {
  const { upsertFood } = useSwFoods();
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [swips, setSwips] = useState('0');
  const [isFree, setIsFree] = useState(false);
  const [heType, setHeType] = useState<HealthyExtraType | 'none'>('none');
  const [heAmount, setHeAmount] = useState('1');
  const [isSpeed, setIsSpeed] = useState(false);

  useEffect(() => {
    if (open) {
      setName(food?.name || '');
      setWeight(food?.weight || '');
      setSwips(String(food?.swips ?? 0));
      setIsFree(!!food?.is_free);
      setHeType(food?.healthy_extra_type || 'none');
      setHeAmount(String(food?.healthy_extra_amount ?? 1));
      setIsSpeed(!!food?.is_speed);
    }
  }, [open, food]);

  const handleFree = () => {
    setSwips('0');
    setIsFree(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    await upsertFood.mutateAsync({
      id: food?.id,
      name: name.trim(),
      weight: weight.trim() || null,
      swips: Number(swips) || 0,
      is_free: isFree,
      healthy_extra_type: heType === 'none' ? null : heType,
      healthy_extra_amount: heType === 'none' ? 0 : Number(heAmount) || 0,
      is_speed: isSpeed,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{food ? 'Edit food' : 'Add food'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Banana" />
          </div>
          <div>
            <Label>Weight / portion</Label>
            <Input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 100g, 1 medium" />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Swips</Label>
              <Input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={swips}
                onChange={(e) => {
                  setSwips(e.target.value);
                  setIsFree(false);
                }}
              />
            </div>
            <Button
              type="button"
              variant={isFree ? 'default' : 'secondary'}
              onClick={handleFree}
              className="h-10"
            >
              <Sparkles className="h-4 w-4 mr-1" /> Free
            </Button>
          </div>

          <div>
            <Label>Healthy Extra</Label>
            <Select value={heType} onValueChange={(v) => setHeType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="calcium">{HEALTHY_EXTRA_LABELS.calcium}</SelectItem>
                <SelectItem value="fibre">{HEALTHY_EXTRA_LABELS.fibre}</SelectItem>
                <SelectItem value="healthy_fats">{HEALTHY_EXTRA_LABELS.healthy_fats}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {heType !== 'none' && (
            <div>
              <Label>HE amount (1.0 = full serving)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                inputMode="decimal"
                value={heAmount}
                onChange={(e) => setHeAmount(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox id="speed" checked={isSpeed} onCheckedChange={(v) => setIsSpeed(!!v)} />
            <Label htmlFor="speed" className="cursor-pointer">Speed food</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || upsertFood.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
