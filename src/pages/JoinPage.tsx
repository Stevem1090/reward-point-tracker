import { useEffect } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PENDING_INVITE_KEY } from '@/components/FamilyGate';

const JoinPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { user, loading } = useAuth();

  useEffect(() => {
    if (token) localStorage.setItem(PENDING_INVITE_KEY, token);
  }, [token]);

  if (!token) return <Navigate to="/" replace />;
  if (loading) return null;
  // Signed in: the family gate picks up the pending invite on load.
  if (user) return <Navigate to="/profile" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You've been invited to Family Hub</CardTitle>
          <CardDescription>
            Sign in or create an account with the email address the invite was sent to. You'll join the family automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="min-h-11"><Link to="/signup">Create an account</Link></Button>
          <Button asChild variant="outline" className="min-h-11"><Link to="/login">I already have an account</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinPage;
