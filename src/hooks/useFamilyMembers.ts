import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type FamilyMember = { id: string; name: string; color: string };

// Distinct fallback colours so every person still gets their own badge colour.
const PALETTE = ['#6366f1', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#14b8a6'];

export const memberColor = (member: { id: string; color?: string | null }) => {
  if (member.color) return member.color;
  let hash = 0;
  for (const ch of member.id) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return PALETTE[hash % PALETTE.length];
};

export const initialOf = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

export function useFamilyMembers() {
  const query = useQuery({
    queryKey: ['family_members_profiles'],
    queryFn: async (): Promise<FamilyMember[]> => {
      const { data: members, error } = await supabase.from('family_members').select('user_id').order('created_at');
      if (error) throw error;
      const ids = (members ?? []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase.from('user_profiles').select('id, name, color').in('id', ids);
      return ids.map((id) => {
        const p = profiles?.find((x) => x.id === id);
        return { id, name: p?.name || 'Member', color: memberColor({ id, color: p?.color }) };
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  return { members: query.data ?? [], isLoading: query.isLoading };
}
