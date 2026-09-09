import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  bank_name?: string;
  account_number?: string;
  bank_account_number?: string;
  account_holder_name?: string;
  routing_number?: string;
  balance?: number;
  accrued_return?: number;
  total_roi?: number;
  user_code?: string;
  account_status?: string;
  last_withdrawal_date?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  signUp: (email: string, password: string, name: string, metadata?: any) => Promise<{ data: any; error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
  refreshProfile: () => Promise<UserProfile | null>;
  updateProfileState: (partial: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authUser: User) => {
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      const userMeta = authUser.user_metadata || {};
      const metaName = userMeta.name || `${userMeta.first_name || ''} ${userMeta.surname || ''}`.trim() || authUser.email?.split('@')[0] || "Investor";
      const metaPhone = userMeta.phone || '';

      if (!prof) {
        // Create initial profile row if missing for a brand new user
        const { data: newProf } = await supabase
          .from('profiles')
          .upsert({
            id: authUser.id,
            email: authUser.email,
            name: metaName,
            phone: metaPhone,
            first_name: userMeta.first_name || null,
            surname: userMeta.surname || null,
            country: userMeta.country || null,
            state: userMeta.state || null,
            lga: userMeta.lga || null,
            balance: 0,
            account_status: 'active'
          })
          .select('*')
          .single();

        if (newProf) {
          setProfile(newProf);
          return newProf;
        }
      } else {
        // Auto-sync missing metadata to existing profile row
        const updates: any = {};
        if (!prof.name && metaName) updates.name = metaName;
        if (!prof.phone && metaPhone) updates.phone = metaPhone;
        if (!prof.email && authUser.email) updates.email = authUser.email;
        if (!prof.first_name && userMeta.first_name) updates.first_name = userMeta.first_name;
        if (!prof.surname && userMeta.surname) updates.surname = userMeta.surname;

        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', authUser.id);
          const updatedProf = { ...prof, ...updates };
          setProfile(updatedProf);
          return updatedProf;
        }

        setProfile(prof);
        return prof;
      }
    } catch (e) {
      console.warn("Profile fetch/sync warning in AuthContext:", e);
    }
    return null;
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (!user) return null;
    return await fetchProfile(user);
  };

  const updateProfileState = (partial: Partial<UserProfile>) => {
    setProfile(prev => (prev ? { ...prev, ...partial } : (partial as UserProfile)));
  };

  const signUp = async (email: string, password: string, name: string, metadata?: any) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata || {
          name: name,
        }
      }
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    setProfile(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, signUp, signIn, signOut, loading, refreshProfile, updateProfileState }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
