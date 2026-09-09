import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  BookOpen,
  FolderPlus,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/curso", label: "Meu curso", icon: BookOpen },
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/ia", label: "IA do Jhon", icon: Sparkles },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const initials = (profile?.full_name || user?.email || "A")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const menu = (
    <div className="flex h-full flex-col gap-1 p-4">
      <Link to="/dashboard" className="mb-6 flex items-center gap-3 px-2" onClick={() => setOpen(false)}>
        <span className="grid size-10 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">
          IJ
        </span>
        <span className="leading-tight">
          <span className="block font-display text-sm font-bold">INFORMÁTICA COM JHON</span>
          <span className="block text-[11px] tracking-widest text-muted-foreground">PARA CONCURSOS</span>
        </span>
      </Link>

      {nav.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={() => setOpen(false)}
          activeProps={{ className: "bg-secondary text-foreground" }}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <item.icon className="size-4" />
          {item.label}
        </Link>
      ))}

      {isAdmin && (
        <>
          <p className="mt-6 px-3 pb-1 text-[11px] tracking-widest text-muted-foreground">ADMINISTRAÇÃO</p>
          <Link
            to="/admin"
            onClick={() => setOpen(false)}
            activeProps={{ className: "bg-secondary text-foreground" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Settings className="size-4" />
            Painel do professor
          </Link>
          <Link
            to="/admin/modulos"
            onClick={() => setOpen(false)}
            activeProps={{ className: "bg-secondary text-foreground" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <FolderPlus className="size-4" />
            Módulos
          </Link>
          <Link
            to="/admin/aulas/nova"
            onClick={() => setOpen(false)}
            activeProps={{ className: "bg-secondary text-foreground" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <GraduationCap className="size-4" />
            Nova aula
          </Link>
        </>
      )}

      <div className="mt-auto space-y-2">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
            {initials}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-medium">{profile?.full_name || "Aluno"}</span>
            <span className="block text-[11px] text-muted-foreground">{isAdmin ? "Professor" : "Aluno"}</span>
          </span>
        </div>
        <button
          onClick={sair}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-sidebar lg:block">{menu}</aside>

      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-background/80 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-72 border-r border-border bg-sidebar transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute right-3 top-4 text-muted-foreground"
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
          {menu}
        </div>
      </div>

      <div className="lg:pl-64">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>
          <span className="font-display text-sm font-bold">INFORMÁTICA COM JHON</span>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
