import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = { id: string; full_name: string; email: string; whatsapp: string };

export type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const ADMIN_EMAILS = new Set([
  "professorjonatasg@gmail.com",
  "professorjonatas@gmail.com",
  "jonatas.gomes@gestao.pms.ad",
]);

export const isEmailAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return (
    ADMIN_EMAILS.has(clean) ||
    clean.startsWith("professorjonatas") ||
    clean.includes("professorjonatas")
  );
};

export const isUserAdmin = (
  email?: string | null,
  fullName?: string | null,
  roles?: { role: string }[] | null
): boolean => {
  if (isEmailAdmin(email)) return true;
  if (roles && roles.some((r) => r.role === "admin")) return true;
  if (fullName) {
    const fn = fullName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (
      fn.includes("professorjonatas") ||
      fn.includes("professor jonatas") ||
      fn === "professorjonatasg"
    ) {
      return true;
    }
  }
  return false;
};

const getInitialAuth = (): { session: Session | null; isAdmin: boolean } => {
  if (typeof window === "undefined") return { session: null, isAdmin: false };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          const u = parsed?.user;
          if (u) {
            const em = u.email || u.user_metadata?.email;
            const fn = u.user_metadata?.full_name || u.user_metadata?.name;
            const admin = isUserAdmin(em, fn);
            return { session: parsed as Session, isAdmin: admin };
          }
        }
      }
    }
  } catch (e) {
    // silencioso para SSR/falhas de parsing
  }
  return { session: null, isAdmin: false };
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
  const initial = getInitialAuth();
  const [session, setSession] = useState<Session | null>(initial.session);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(initial.isAdmin);
  const [loading, setLoading] = useState(true);

  const loadExtras = async (uid: string | undefined, authUser?: User | null) => {
    if (!uid) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }

    let p: Profile | null = null;
    let roles: { role: string }[] | null = null;

    try {
      const [pRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, whatsapp").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      p = (pRes.data as Profile) ?? null;
      roles = rolesRes.data ?? null;
    } catch (e) {
      console.warn("Erro ao buscar dados extras do perfil:", e);
    }

    const emailCandidates = [
      authUser?.email,
      authUser?.user_metadata?.email,
      p?.email,
    ];

    const foundAdminEmail = emailCandidates.find((em) => isEmailAdmin(em));
    const fullNameCandidate = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || p?.full_name;
    const adminStatus = isUserAdmin(foundAdminEmail || authUser?.email, fullNameCandidate, roles);

    setProfile(p);
    setIsAdmin(adminStatus);

    // Se for o professor/administrador principal e ainda não tiver a role em user_roles, insere proativamente
    if (adminStatus && !roles?.some((r) => r.role === "admin")) {
      void supabase.from("user_roles").insert({ user_id: uid, role: "admin" }).then(() => {});
    }
  };

  useEffect(() => {
    const checkImmediate = (u?: User | null) => {
      const em = u?.email || u?.user_metadata?.email;
      const fn = u?.user_metadata?.full_name || u?.user_metadata?.name;
      if (isUserAdmin(em, fn)) {
        setIsAdmin(true);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      checkImmediate(s?.user);
      setTimeout(() => {
        void loadExtras(s?.user?.id, s?.user);
      }, 0);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      checkImmediate(data.session?.user);
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
