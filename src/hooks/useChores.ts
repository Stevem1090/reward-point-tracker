import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  CategoryWithChores,
  Chore,
  ChoreCategory,
  ChoreCompletion,
  ChoreFrequency,
  ChoreWithCompletions,
} from '@/types/chore';
import { getThisWeekBounds } from '@/utils/getWeekBounds';

export const useChores = (selectedYear: number) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<ChoreCategory[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [completions, setCompletions] = useState<ChoreCompletion[]>([]);
  const [pendingCompletions, setPendingCompletions] = useState<ChoreCompletion[]>([]);
  const [removedCompletionIds, setRemovedCompletionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const refetchTimer = useRef<number | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const yearStart = new Date(selectedYear, 0, 1).toISOString();
    const yearEnd = new Date(selectedYear + 1, 0, 1).toISOString();

    const [catsRes, choresRes, compsRes, allCompYearsRes] = await Promise.all([
      supabase.from('chore_categories').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('chores').select('*').eq('user_id', user.id).eq('archived', false).order('created_at'),
      supabase
        .from('chore_completions')
        .select('*')
        .eq('user_id', user.id)
        .gte('completed_at', yearStart)
        .lt('completed_at', yearEnd),
      supabase
        .from('chore_completions')
        .select('completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: true })
        .limit(1),
    ]);

    if (catsRes.data) setCategories(catsRes.data as ChoreCategory[]);
    if (choresRes.data) setChores(choresRes.data as Chore[]);
    if (compsRes.data) setCompletions(compsRes.data as ChoreCompletion[]);

    const currentYear = new Date().getFullYear();
    const earliest = allCompYearsRes.data?.[0]?.completed_at
      ? new Date(allCompYearsRes.data[0].completed_at).getFullYear()
      : currentYear;
    const years: number[] = [];
    for (let y = currentYear; y >= earliest; y--) years.push(y);
    setAvailableYears(years);

    setLoading(false);
  }, [user, selectedYear]);

  const debouncedRefetch = useCallback(() => {
    if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
    refetchTimer.current = window.setTimeout(() => {
      fetchAll();
    }, 300);
  }, [fetchAll]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chores-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_categories' }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores' }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_completions' }, debouncedRefetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
    };
  }, [user, debouncedRefetch]);

  // Merge real + pending - removed
  const effectiveCompletions = useMemo<ChoreCompletion[]>(() => {
    const base = completions.filter((c) => !removedCompletionIds.has(c.id));
    return [...base, ...pendingCompletions];
  }, [completions, pendingCompletions, removedCompletionIds]);

  const grouped = useMemo<CategoryWithChores[]>(() => {
    const { start: weekStart, end: weekEnd } = getThisWeekBounds();
    return categories.map((category) => {
      const catChores: ChoreWithCompletions[] = chores
        .filter((c) => c.category_id === category.id)
        .map((c) => ({
          ...c,
          completions: effectiveCompletions.filter((cmp) => cmp.chore_id === c.id),
        }));

      const repeating = catChores.filter((c) => c.frequency !== 'adhoc');
      const completedThisWeek = repeating.filter((c) =>
        c.completions.some((cmp) => {
          const t = new Date(cmp.completed_at);
          return t >= weekStart && t <= weekEnd;
        })
      ).length;

      return {
        category,
        chores: catChores,
        completedThisWeek,
        totalRepeating: repeating.length,
      };
    });
  }, [categories, chores, effectiveCompletions]);

  // Mutations ----------------------------------------------------------------

  const addCategory = async (name: string, color = '#8B5CF6') => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('chore_categories')
      .insert({ user_id: user.id, name, color, sort_order: categories.length })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
    return data as ChoreCategory;
  };

  const addChore = async (params: {
    name: string;
    category_id: string;
    frequency: ChoreFrequency;
  }) => {
    if (!user) return;
    const { error } = await supabase.from('chores').insert({
      user_id: user.id,
      name: params.name,
      category_id: params.category_id,
      frequency: params.frequency,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Chore added', description: params.name });
    }
  };

  const logCompletion = async (chore_id: string) => {
    if (!user) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: ChoreCompletion = {
      id: tempId,
      chore_id,
      user_id: user.id,
      completed_at: new Date().toISOString(),
    };
    setPendingCompletions((prev) => [...prev, optimistic]);

    const { error } = await supabase
      .from('chore_completions')
      .insert({ chore_id, user_id: user.id });

    if (error) {
      setPendingCompletions((prev) => prev.filter((c) => c.id !== tempId));
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Remove pending; realtime/refetch will bring real one shortly
      setTimeout(() => {
        setPendingCompletions((prev) => prev.filter((c) => c.id !== tempId));
      }, 600);
    }
  };

  const undoLastCompletionInPeriod = async (
    chore_id: string,
    periodStart: Date,
    periodEnd: Date
  ) => {
    if (!user) return;

    // Find the latest from pending or real (using effectiveCompletions logic inline)
    const candidates = [
      ...pendingCompletions,
      ...completions.filter((c) => !removedCompletionIds.has(c.id)),
    ]
      .filter(
        (c) =>
          c.chore_id === chore_id &&
          new Date(c.completed_at) >= periodStart &&
          new Date(c.completed_at) <= periodEnd
      )
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

    const last = candidates[0];
    if (!last) return;

    if (last.id.startsWith('temp-')) {
      // Just remove the optimistic insert; if backend insert is in flight it will be no-op-ish
      setPendingCompletions((prev) => prev.filter((c) => c.id !== last.id));
      // Best-effort: also delete most recent server row in period (in case this temp already persisted)
      const { data: serverRows } = await supabase
        .from('chore_completions')
        .select('id, completed_at')
        .eq('user_id', user.id)
        .eq('chore_id', chore_id)
        .gte('completed_at', periodStart.toISOString())
        .lte('completed_at', periodEnd.toISOString())
        .order('completed_at', { ascending: false })
        .limit(1);
      const row = serverRows?.[0];
      if (row) {
        await supabase.from('chore_completions').delete().eq('id', row.id);
      }
      return;
    }

    // Optimistic remove
    setRemovedCompletionIds((prev) => new Set(prev).add(last.id));
    const { error } = await supabase.from('chore_completions').delete().eq('id', last.id);
    if (error) {
      setRemovedCompletionIds((prev) => {
        const next = new Set(prev);
        next.delete(last.id);
        return next;
      });
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const toggleAdhocComplete = async (chore: Chore) => {
    if (!user) return;
    const { error } = await supabase
      .from('chores')
      .update({ completed_at: chore.completed_at ? null : new Date().toISOString() })
      .eq('id', chore.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
  };

  const deleteChore = async (chore_id: string) => {
    const { error } = await supabase.from('chores').delete().eq('id', chore_id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
  };

  const deleteCategory = async (category_id: string) => {
    const { error } = await supabase.from('chore_categories').delete().eq('id', category_id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
  };

  return {
    loading,
    categories,
    grouped,
    availableYears,
    addCategory,
    addChore,
    logCompletion,
    undoLastCompletionInPeriod,
    toggleAdhocComplete,
    deleteChore,
    deleteCategory,
  };
};
