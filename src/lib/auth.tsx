import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = { id: string; full_name: string; email: string; whatsapp: string };

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const ADMIN_EMAILS = new Set(["professorjonatasg@gmail.com"]);

export const isEmailAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
};

const AuthContext = createContext<AuthValue>({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadExtras = async (uid: string | undefined, authUser?: User | null) => {
    if (!uid) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, whatsapp").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);

    const userEmail = (authUser?.email || p?.email || "").toLowerCase().trim();
    const isOwnerAdmin = isEmailAdmin(userEmail);
    const hasRoleAdmin = Boolean(roles?.some((r) => r.role === "admin"));
    const adminStatus = isOwnerAdmin || hasRoleAdmin;

    setProfile((p as Profile) ?? null);
    setIsAdmin(adminStatus);

    // Se for o professor/administrador principal e ainda não tiver a role salva, cadastra em user_roles
    if (isOwnerAdmin && !hasRoleAdmin) {
      void supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (isEmailAdmin(s?.user?.email)) {
        setIsAdmin(true);
      }
      setTimeout(() => {
        void loadExtras(s?.user?.id, s?.user);
      }, 0);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (isEmailAdmin(data.session?.user?.email)) {
        setIsAdmin(true);
      }
      await loadExtras(data.session?.user?.id, data.session?.user);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    session,
    user: session?.user ?? null,
    profile,
    isAdmin,
    loading,
    refresh: async () => loadExtras(session?.user?.id, session?.user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
