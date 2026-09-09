import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, FolderPlus, GraduationCap, ListChecks, PlusCircle, Settings, Users, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Painel do Professor — Informática com Jhon" },
      { name: "description", content: "Administração do curso e gestão de conteúdo." },
    ],
  }),
  component: AdminIndexPage,
});

function AdminIndexPage() {
  const { isAdmin, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["admin_overview"],
    enabled: isAdmin,
    queryFn: async () => {
      const [modulesRes, lessonsRes, profilesRes, questionsRes] = await Promise.all([
        supabase.from("modules").select("id, title, position").order("position"),
        supabase.from("lessons").select("id, title, module_id, position").order("position"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("questions").select("id", { count: "exact", head: true }),
      ]);

      return {
        modules: modulesRes.data ?? [],
        lessons: lessonsRes.data ?? [],
        totalAlunos: profilesRes.count ?? 0,
        totalQuestoes: questionsRes.count ?? 0,
      };
    },
  });

  if (loading || isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando painel...</p>
      </div>
    );
  }

  // Verificação rigorosa de papel: Estudantes não têm acesso
  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center space-y-4 max-w-md mx-auto my-12">
        <div className="grid size-12 place-items-center rounded-full bg-red-500/10 text-red-500 mx-auto">
          <Settings className="size-6" />
        </div>
        <h2 className="text-xl font-bold font-display">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Esta área é exclusiva para o professor e administradores da plataforma.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Voltar ao meu painel
        </Link>
      </div>
    );
  }

  const modules = data?.modules ?? [];
  const lessons = data?.lessons ?? [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">ÁREA ADMINISTRATIVA</p>
          <h1 className="mt-1 text-3xl font-bold font-display md:text-4xl">Painel do Professor</h1>
          <p className="mt-1 text-muted-foreground">Gerencie módulos, aulas, materiais e questões do curso.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/modulos"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80"
          >
            <FolderPlus className="size-4" /> Gerenciar Módulos
          </Link>
          <Link
            to="/admin/aulas/nova"
            className="glow-primary inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            <PlusCircle className="size-4" /> Publicar Nova Aula
          </Link>
        </div>
      </header>

      {/* Cards de Métricas do Administrador */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="panel p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Módulos</span>
            <BookOpen className="size-4 text-primary" />
          </div>
          <p className="mt-3 font-display text-3xl font-bold">{modules.length}</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Videoaulas</span>
            <Video className="size-4 text-primary" />
          </div>
          <p className="mt-3 font-display text-3xl font-bold">{lessons.length}</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Alunos Cadastrados</span>
            <Users className="size-4 text-primary" />
          </div>
          <p className="mt-3 font-display text-3xl font-bold">{data?.totalAlunos ?? 0}</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Questões no Banco</span>
            <ListChecks className="size-4 text-primary" />
          </div>
          <p className="mt-3 font-display text-3xl font-bold">{data?.totalQuestoes ?? 0}</p>
        </div>
      </section>

      {/* Visão de Conteúdo Cadastrado */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-display">Grade de Conteúdo Atual</h2>

        <div className="space-y-4">
          {modules.map((m) => {
            const modLessons = lessons.filter((l) => l.module_id === m.id);
            return (
              <div key={m.id} className="panel p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <span className="text-xs font-semibold text-accent uppercase tracking-widest">
                      Posição {m.position}
                    </span>
                    <h3 className="text-lg font-bold font-display">{m.title}</h3>
                  </div>
                  <span className="text-xs rounded-full bg-secondary px-3 py-1 font-semibold text-muted-foreground">
                    {modLessons.length} aulas
                  </span>
                </div>

                <div className="divide-y divide-border/40">
                  {modLessons.map((l) => (
                    <div key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">#{l.position}</span>
                        <span className="font-medium">{l.title}</span>
                      </div>
                      <Link
                        to="/curso/aula/$aulaId"
                        params={{ aulaId: l.id }}
                        className="text-xs text-primary hover:underline"
                      >
                        Visualizar aula
                      </Link>
                    </div>
                  ))}
                  {modLessons.length === 0 && (
                    <p className="py-2 text-xs italic text-muted-foreground">Nenhuma aula neste módulo.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
