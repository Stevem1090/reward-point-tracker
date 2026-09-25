import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Copy, Loader2, Mail, Users, X } from 'lucide-react';

const FamilySettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['family', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: family } = await supabase.from('families').select('id, name, owner_id').maybeSingle();
      const { data: members } = await supabase.from('family_members').select('user_id, role, created_at').order('created_at');
      const ids = (members ?? []).map((m) => m.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from('user_profiles').select('id, name').in('id', ids)
        : { data: [] as { id: string; name: string | null }[] };
      const isMaster = (members ?? []).some((m) => m.user_id === user!.id && m.role === 'master');
      const { data: invites } = isMaster
        ? await supabase.from('family_invites').select('id, email, expires_at').is('accepted_at', null).order('created_at', { ascending: false })
        : { data: [] as { id: string; email: string; expires_at: string }[] };
      return {
        family,
        isMaster,
        members: (members ?? []).map((m) => ({ ...m, name: profiles?.find((p) => p.id === m.user_id)?.name ?? 'Family member' })),
        invites: (invites ?? []).filter((i) => new Date(i.expires_at) > new Date()),
      };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['family'] });

  const invite = async () => {
    setSending(true);
    setLastLink(null);
    const { data: res, error } = await supabase.functions.invoke('send-family-invite', {
      body: { email, origin: window.location.origin },
    });
    setSending(false);
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { msg = (await error.context.json()).error ?? msg; } catch { /* keep */ }
      }
      toast({ title: "Couldn't send invite", description: msg, variant: 'destructive' });
      return;
    }
    setLastLink(res.link);
    toast({
      title: res.emailSent ? 'Invite sent' : 'Invite created',
      description: res.emailSent ? `We've emailed ${email}.` : "The email couldn't be sent — copy the link below and send it yourself.",
    });
    setEmail('');
    refresh();
  };

  const cancelInvite = async (id: string) => {
    await supabase.from('family_invites').delete().eq('id', id);
    refresh();
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.rpc('remove_family_member', { _user: id });
    if (error) toast({ title: "Couldn't remove", description: error.message, variant: 'destructive' });
    else toast({ title: 'Removed', description: 'They no longer have access to your family.' });
    refresh();
  };

  const leave = async () => {
    const { error } = await supabase.rpc('leave_family');
    if (error) return toast({ title: "Couldn't leave", description: error.message, variant: 'destructive' });
    window.location.reload();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Link copied' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> {data?.family?.name ?? 'Family'}</CardTitle>
        <CardDescription>
          Everyone in your family shares bills, rewards, calendar, meals, chores and tasks. Slimming World logs and "only me" tasks stay personal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <ul className="divide-y rounded-md border">
              {data?.members.map((m) => (
                <li key={m.user_id} className="flex min-h-12 items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate">
                    {m.name}{m.user_id === user?.id && <span className="text-muted-foreground"> (you)</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    {m.role === 'master' && <Badge variant="secondary">Master</Badge>}
                    {data.isMaster && m.role !== 'master' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="min-h-11 text-destructive">Remove</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {m.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              They'll immediately lose access to everything in your family. Anything they added stays with the family.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeMember(m.user_id)}>Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {data?.isMaster ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Invite someone</p>
                <div className="flex gap-2">
                  <Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <Button onClick={invite} disabled={sending || !email} className="min-h-11">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    <span className="ml-1">Invite</span>
                  </Button>
                </div>
                {lastLink && (
                  <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs">
                    <span className="min-w-0 flex-1 truncate">{lastLink}</span>
                    <Button size="sm" variant="ghost" className="min-h-11" onClick={() => copy(lastLink)}><Copy className="h-4 w-4" /></Button>
                  </div>
                )}
                {!!data.invites.length && (
                  <ul className="space-y-1">
                    <p className="text-sm text-muted-foreground">Pending invites</p>
                    {data.invites.map((i) => (
                      <li key={i.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{i.email}</span>
                        <Button variant="ghost" size="sm" className="min-h-11" onClick={() => cancelInvite(i.id)} aria-label="Cancel invite">
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="min-h-11">Leave family</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave this family?</AlertDialogTitle>
                    <AlertDialogDescription>You'll lose access to the shared bills, meals, tasks and everything else. You'll start with a fresh, empty family.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={leave}>Leave</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FamilySettings;
