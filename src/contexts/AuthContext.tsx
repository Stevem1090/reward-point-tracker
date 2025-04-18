import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Session, User, AuthError } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: AuthError | null; data: { user: User | null } | null }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (currentSession) {
          console.log('Auth state changed:', event, 'User ID:', currentSession.user?.id);
        } else {
          console.log('Auth state changed:', event, 'No session');
        }
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (event === 'SIGNED_IN') {
          // Ensure user profile exists when signed in
          await ensureUserProfile(currentSession?.user);
          
          toast({
            title: "Welcome back!",
            description: "You're now signed in",
          });
        } else if (event === 'SIGNED_OUT') {
          toast({
            title: "Signed out",
            description: "You've been signed out successfully",
          });
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log('Initial session check:', currentSession ? `User ID: ${currentSession.user?.id}` : 'No session');
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      // Ensure user profile exists for existing session
      if (currentSession?.user) {
        await ensureUserProfile(currentSession.user);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [toast]);

  // Helper function to ensure user profile exists
  const ensureUserProfile = async (authUser: User | null) => {
    if (!authUser) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking user profile:', error);
        return;
      }

      // If no profile exists, create one
      if (!data) {
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: authUser.id,
            name: authUser.email?.split('@')[0] || 'User'
          });

        if (insertError) {
          console.error('Error creating user profile:', insertError);
          toast({
            title: "Profile Creation Error",
            description: "Could not create user profile",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Unexpected error in ensureUserProfile:', error);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      setLoading(true);
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name // Optional name during signup
          }
        }
      });

      if (result.error) {
        toast({
          title: "Error creating account",
          description: result.error.message,
          variant: "destructive",
        });
      } else if (result.data.user) {
        toast({
          title: "Account created!",
          description: "Please check your email to confirm your account",
        });
        navigate('/');
      }
      
      return result;
    } catch (error: any) {
      toast({
        title: "Error creating account",
        description: error.message,
        variant: "destructive",
      });
      return { 
        error: { message: error.message } as AuthError, 
        data: null 
      };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error signing in",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      navigate('/login');
    } catch (error: any) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, signUp, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
