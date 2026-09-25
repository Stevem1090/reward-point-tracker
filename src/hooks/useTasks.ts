import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type TaskSection = { id: string; name: string; sort_order: number };
export type Task = {
  id: string;
  section_id: string;
  title: string;
  notes: string | null;
  done: boolean;
  done_at: string | null;
  due_at: string | null;
  is_private: boolean;
  owner_id: string;
  sort_order: number;
};

const SECTIONS_KEY = ['task_sections'];
const TASKS_KEY = ['tasks'];

export function useTasks() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const sectionsQ = useQuery({
    queryKey: SECTIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('task_sections').select('id, name, sort_order').order('sort_order');
      if (error) throw error;
      return data as TaskSection[];
    },
  });

  const tasksQ = useQuery({
    queryKey: TASKS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').order('sort_order').order('created_at');
      if (error) throw error;
      return data as Task[];
    },
  });

  const fail = (e: unknown) => {
    toast({ title: 'Something went wrong', description: (e as Error).message, variant: 'destructive' });
    qc.invalidateQueries({ queryKey: TASKS_KEY });
    qc.invalidateQueries({ queryKey: SECTIONS_KEY });
  };

  const setTasks = (fn: (t: Task[]) => Task[]) => qc.setQueryData<Task[]>(TASKS_KEY, (old) => fn(old ?? []));
  const setSections = (fn: (s: TaskSection[]) => TaskSection[]) =>
    qc.setQueryData<TaskSection[]>(SECTIONS_KEY, (old) => fn(old ?? []));

  const addTask = async (input: { section_id: string; title: string; due_at?: string | null; is_private?: boolean; notes?: string | null }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const min = Math.min(0, ...(tasksQ.data ?? []).filter((t) => t.section_id === input.section_id).map((t) => t.sort_order));
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...input, owner_id: user.id, sort_order: min - 1 })
      .select()
      .single();
    if (error) return fail(error);
    setTasks((t) => [data as Task, ...t]);
  };

  const updateTask = async (id: string, patch: Partial<Task>) => {
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('tasks').update(patch).eq('id', id);
    if (error) fail(error);
  };

  const deleteTask = async (id: string) => {
    setTasks((t) => t.filter((x) => x.id !== id));
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) fail(error);
  };

  /** Save a new order for tasks (after drag and drop). */
  const saveTaskOrder = async (ordered: Task[]) => {
    const before = new Map((tasksQ.data ?? []).map((t) => [t.id, t]));
    const changed = ordered.filter((t) => {
      const b = before.get(t.id);
      return !b || b.sort_order !== t.sort_order || b.section_id !== t.section_id;
    });
    setTasks(() => ordered);
    const results = await Promise.all(
      changed.map((t) => supabase.from('tasks').update({ sort_order: t.sort_order, section_id: t.section_id }).eq('id', t.id))
    );
    const err = results.find((r) => r.error)?.error;
    if (err) fail(err);
  };

  const addSection = async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const max = Math.max(-1, ...(sectionsQ.data ?? []).map((s) => s.sort_order));
    const { data, error } = await supabase
      .from('task_sections')
      .insert({ name, sort_order: max + 1, created_by: user?.id })
      .select('id, name, sort_order')
      .single();
    if (error) return fail(error);
    setSections((s) => [...s, data as TaskSection]);
  };

  const renameSection = async (id: string, name: string) => {
    setSections((s) => s.map((x) => (x.id === id ? { ...x, name } : x)));
    const { error } = await supabase.from('task_sections').update({ name }).eq('id', id);
    if (error) fail(error);
  };

  const deleteSection = async (id: string) => {
    setSections((s) => s.filter((x) => x.id !== id));
    setTasks((t) => t.filter((x) => x.section_id !== id));
    const { error } = await supabase.from('task_sections').delete().eq('id', id);
    if (error) fail(error);
  };

  const saveSectionOrder = async (ordered: TaskSection[]) => {
    const withOrder = ordered.map((s, i) => ({ ...s, sort_order: i }));
    setSections(() => withOrder);
    const results = await Promise.all(
      withOrder.map((s) => supabase.from('task_sections').update({ sort_order: s.sort_order }).eq('id', s.id))
    );
    const err = results.find((r) => r.error)?.error;
    if (err) fail(err);
  };

  return {
    sections: sectionsQ.data ?? [],
    tasks: tasksQ.data ?? [],
    isLoading: sectionsQ.isLoading || tasksQ.isLoading,
    addTask, updateTask, deleteTask, saveTaskOrder,
    addSection, renameSection, deleteSection, saveSectionOrder,
  };
}
