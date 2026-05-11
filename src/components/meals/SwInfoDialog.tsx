import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRecipes } from '@/hooks/useRecipes';
import { HEALTHY_EXTRA_LABELS, HealthyExtraType } from '@/types/slimmingWorld';
import { Ingredient } from '@/types/meal';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mealId: string;
  recipeId: string | null;
  mealName: string;
  description?: string | null;
  servings?: number;
  estimatedCookMinutes?: number | null;
  recipeUrl?: string | null;
  ingredients?: Ingredient[];
  steps?: string[];
  imageUrl?: string | null;
  initial?: {
    sw_swips: number | null;
    sw_healthy_extra_type: HealthyExtraType | null;
    sw_healthy_extra_amount: number | null;
    sw_is_speed: boolean | null;
  } | null;
  onSaved?: (recipeId: string) => void;
}

export function SwInfoDialog({
  open,
  onOpenChange,
  mealId,
  recipeId,
  mealName,
  description,
  servings,
  estimatedCookMinutes,
  recipeUrl,
  ingredients,
  steps,
  imageUrl,
  initial,
  onSaved,
}: Props) {
  const { upsertSwInfo } = useRecipes();
  const [swips, setSwips] = useState('');
  const [heType, setHeType] = useState<HealthyExtraType | 'none'>('none');
  const [heAmount, setHeAmount] = useState('');
  const [isSpeed, setIsSpeed] = useState(false);

  useEffect(() => {
    if (open) {
      setSwips(initial?.sw_swips != null ? String(initial.sw_swips) : '');
      setHeType((initial?.sw_healthy_extra_type as HealthyExtraType | null) ?? 'none');
      setHeAmount(initial?.sw_healthy_extra_amount != null ? String(initial.sw_healthy_extra_amount) : '');
      setIsSpeed(!!initial?.sw_is_speed);
    }
  }, [open, initial]);

  const handleSave = async () => {
    const sw = {
      sw_swips: swips === '' ? null : Number(swips),
      sw_healthy_extra_type: heType === 'none' ? null : heType,
      sw_healthy_extra_amount: heType === 'none' ? null : (heAmount === '' ? null : Number(heAmount)),
      sw_is_speed: isSpeed,
    };
    const newId = await upsertSwInfo.mutateAsync({
      mealId,
      recipeId,
      mealName,
      description,
      servings,
      estimatedCookMinutes,
      recipeUrl,
      ingredients,
      steps,
      imageUrl,
      sw,
    });
    onSaved?.(newId);
    onOpenChange(false);
  };

  const hasExisting = !!(initial && (initial.sw_swips != null || initial.sw_healthy_extra_type));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{hasExisting ? 'Edit Slimming World info' : 'Add Slimming World info'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sw-swips">Swips (per serving)</Label>
            <Input
              id="sw-swips"
              type="number"
              step="0.5"
              min="0"
              inputMode="decimal"
              value={swips}
              onChange={(e) => setSwips(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Healthy Extra</Label>
            <Select value={heType} onValueChange={(v) => setHeType(v as HealthyExtraType | 'none')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(Object.keys(HEALTHY_EXTRA_LABELS) as HealthyExtraType[]).map((k) => (
                  <SelectItem key={k} value={k}>{HEALTHY_EXTRA_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {heType !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="sw-he-amount">Amount</Label>
              <Input
                id="sw-he-amount"
                type="number"
                step="0.5"
                min="0"
                inputMode="decimal"
                value={heAmount}
                onChange={(e) => setHeAmount(e.target.value)}
                placeholder="1"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="sw-speed">Speed food</Label>
            <Switch id="sw-speed" checked={isSpeed} onCheckedChange={setIsSpeed} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={upsertSwInfo.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={upsertSwInfo.isPending}>
            {upsertSwInfo.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
