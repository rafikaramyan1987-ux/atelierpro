'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase/client';
import type { Profile } from './types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  registering: boolean;
  setRegistering: (v: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, options?: { data?: Record<string, string> }) => Promise<{ error: string | null; session: Session | null; user: User | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  createGarageAsAdmin: (name: string, phone?: string, email?: string) => Promise<{ error: string | null; garageId: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && typeof window !== 'undefined' && window.location.pathname !== '/reinitialiser-mot-de-passe') {
        window.location.href = '/reinitialiser-mot-de-passe';
        return;
      }
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setLoading(true);
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string, retries = 0): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
    }

    if (!data && retries < 5) {
      await new Promise((r) => setTimeout(r, 600));
      return fetchProfile(userId, retries + 1);
    }

    // Deferred client registration: if the user signed up as a client
    // (user_metadata.account_type === 'client') but the profile is still
    // mecanicien with no garage_id and no client_id, call register_client.
    if (data && data.role === 'mecanicien' && !data.garage_id && !data.client_id) {
      const { data: userData } = await supabase.auth.getUser();
      const meta = userData.user?.user_metadata as Record<string, string> | undefined;
      if (meta?.account_type === 'client') {
        const { error: regError } = await supabase.rpc('register_client', {
          p_first_name: meta.first_name ?? '',
          p_last_name: meta.last_name ?? '',
          p_phone: meta.phone ?? '',
          p_brand: meta.brand || null,
          p_model: meta.model || null,
          p_plate: meta.plate || null,
        });
        if (!regError) {
          const { data: updatedProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          if (updatedProfile) {
            setProfile(updatedProfile as Profile);
            setLoading(false);
            return updatedProfile as Profile;
          }
        }
      }
    }

    setProfile(data as Profile | null);
    setLoading(false);
    return data as Profile | null;
  }

  async function refreshProfile(): Promise<Profile | null> {
    if (!user) return null;
    return fetchProfile(user.id);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string, options?: { data?: Record<string, string> }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, ...(options?.data ?? {}) } },
    });

    if (error) {
      return { error: error.message, session: null, user: null };
    }

    // The trigger creates a minimal profile (email as name, role=mecanicien).
    // We only update the full_name here. Role and client_id are set by
    // register_client or create_garage_as_admin (SECURITY DEFINER functions).
    if (data.user) {
      await new Promise((r) => setTimeout(r, 500));

      await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', data.user.id);
    }

    return { error: null, session: data.session ?? null, user: data.user ?? null };
  }

  async function createGarageAsAdmin(name: string, phone?: string, email?: string): Promise<{ error: string | null; garageId: string | null }> {
    const { data, error } = await supabase.rpc('create_garage_as_admin', {
      p_name: name,
      p_phone: phone ?? '',
      p_email: email ?? null,
    });
    if (error) {
      return { error: error.message, garageId: null };
    }
    if (user) {
      await fetchProfile(user.id);
    }
    return { error: null, garageId: data as string };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, registering, setRegistering, signIn, signUp, signOut, refreshProfile, createGarageAsAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
