import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import {
  HealthyExtraType,
  SwFood,
  SwLogEntry,
  SwLogEntryType,
  SwMealWithItems,
} from '@/types/slimmingWorld';

export function formatDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function getWeekStartMonday(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 });
}

export function useSwLog(weekStart: Date) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const start = formatDate(weekStart);
  const end = formatDate(endOfWeek(weekStart, { weekStartsOn: 1 }));

  const logQuery = useQuery({
    queryKey: ['sw_log', user?.id, start, end],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sw_log_entries')
        .select('*')
        .gte('log_date', start)
        .lte('log_date', end)
        .order('created_at');
      if (error) throw error;
      return (data || []) as SwLogEntry[];
    },
  });

  const addEntry = useMutation({
    mutationFn: async (input: {
      log_date: string;
      entry_type: SwLogEntryType;
      food?: SwFood;
      meal?: SwMealWithItems;
      recipe?: { id: string; name: string; sw_swips?: number | null; sw_healthy_extra_type?: HealthyExtraType | null; sw_healthy_extra_amount?: number | null; sw_is_speed?: boolean | null };
      quantity?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const qty = Number(input.quantity ?? 1);
      const rows: any[] = [];

      if (input.entry_type === 'food' && input.food) {
        const f = input.food;
        rows.push({
          user_id: user.id,
          log_date: input.log_date,
          entry_type: 'food',
          food_id: f.id,
          name_snapshot: f.name,
          swips_snapshot: Number(f.swips || 0),
          healthy_extra_type_snapshot: f.healthy_extra_type,
          healthy_extra_amount_snapshot: Number(f.healthy_extra_amount || 0),
          is_speed_snapshot: !!f.is_speed,
          quantity: qty,
        });
      } else if (input.entry_type === 'meal' && input.meal) {
        // Aggregate the meal as a single entry (sum its foods).
        let swips = 0;
        let speed = false;
        // For meals with mixed HE types, log a single row per HE type touched.
        const heTotals: Record<string, number> = {};
        for (const item of input.meal.items) {
          const f = item.food;
          if (!f) continue;
          const itemQty = Number(item.quantity || 1);
          swips += Number(f.swips || 0) * itemQty;
          if (f.is_speed) speed = true;
          if (f.healthy_extra_type) {
            heTotals[f.healthy_extra_type] = (heTotals[f.healthy_extra_type] || 0) + Number(f.healthy_extra_amount || 0) * itemQty;
          }
        }
        const heKeys = Object.keys(heTotals);
        if (heKeys.length === 0) {
          rows.push({
            user_id: user.id,
            log_date: input.log_date,
            entry_type: 'meal',
            meal_id: input.meal.id,
            name_snapshot: input.meal.name,
            swips_snapshot: swips,
            healthy_extra_type_snapshot: null,
            healthy_extra_amount_snapshot: 0,
            is_speed_snapshot: speed,
            quantity: qty,
          });
        } else {
          // Split swips across HE rows + a base row if needed
          heKeys.forEach((he, idx) => {
            rows.push({
              user_id: user.id,
              log_date: input.log_date,
              entry_type: 'meal',
              meal_id: input.meal!.id,
              name_snapshot: input.meal!.name + (heKeys.length > 1 ? ` (${he})` : ''),
              swips_snapshot: idx === 0 ? swips : 0,
              healthy_extra_type_snapshot: he as HealthyExtraType,
              healthy_extra_amount_snapshot: heTotals[he],
              is_speed_snapshot: idx === 0 ? speed : false,
              quantity: qty,
            });
          });
        }
      } else if (input.entry_type === 'recipe' && input.recipe) {
        const r = input.recipe;
        rows.push({
          user_id: user.id,
          log_date: input.log_date,
          entry_type: 'recipe',
          recipe_id: r.id,
          name_snapshot: r.name,
          swips_snapshot: Number(r.sw_swips || 0),
          healthy_extra_type_snapshot: r.sw_healthy_extra_type ?? null,
          healthy_extra_amount_snapshot: Number(r.sw_healthy_extra_amount || 0),
          is_speed_snapshot: !!r.sw_is_speed,
          quantity: qty,
        });
      }

      if (rows.length === 0) return;
      const { error } = await supabase.from('sw_log_entries').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sw_log'] });
      toast({ title: 'Logged' });
    },
    onError: (e: any) => toast({ title: 'Failed to log', description: e.message, variant: 'destructive' }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sw_log_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sw_log'] }),
  });

  return { entries: logQuery.data || [], isLoading: logQuery.isLoading, addEntry, deleteEntry };
}
