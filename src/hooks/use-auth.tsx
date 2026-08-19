import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/types";

interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  organization_id: string | null;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: Role;
  canWrite: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (name: string, email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role>("viewer");

  const loadIdentity = async (userId: string) => {
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,user_id,name,email,organization_id").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile((prof as Profile | null) ?? null);
    const list = (roles ?? []).map((r) => r.role as Role);
    setRole(
      list.includes("admin") ? "admin" : list.includes("operator") ? "operator" : "viewer",
    );
  };

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      if (data.session?.user) await loadIdentity(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next ?? null);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setRole("viewer");
        return;
      }
      if (next?.user) void loadIdentity(next.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(() => {
    return {
      loading,
      session,
      user: session?.user ?? null,
      profile,
      role,
      canWrite: role === "admin" || role === "operator",
      isAdmin: role === "admin",
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signUp: async (name, email, password) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name },
          },
        });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refresh: async () => {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) await loadIdentity(data.session.user.id);
      },
    };
  }, [loading, session, profile, role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
