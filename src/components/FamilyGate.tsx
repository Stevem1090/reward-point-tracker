import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const PENDING_INVITE_KEY = 'familyhub.pendingInvite';

/** Accepts any pending invite, then makes sure the signed-in user belongs to a family. */
const FamilyGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const pending = localStorage.getItem(PENDING_INVITE_KEY);
      if (pending) {
        localStorage.removeItem(PENDING_INVITE_KEY);
        const { error } = await supabase.rpc('accept_family_invite', { _token: pending });
        if (error) toast({ title: "Couldn't join family", description: error.message, variant: 'destructive' });
        else toast({ title: 'Welcome to the family!', description: "You now share this family's app." });
      }
      const { error } = await supabase.rpc('ensure_family');
      if (error) console.error('ensure_family failed', error);
      if (!cancelled) {
        qc.invalidateQueries();
        setReadyFor(user.id);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (user && readyFor !== user.id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
      </div>
    );
  }
  return <>{children}</>;
};

export default FamilyGate;
