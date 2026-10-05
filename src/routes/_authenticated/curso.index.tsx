import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, BookOpen, ChevronDown, ChevronRight, GraduationCap, LayoutGrid, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ProgressBar } from "@/components/ProgressBar";
import { Badge } from "@/components/ui/badge";
import { LessonCard } from "@/components/LessonCard";

export const Route = createFileRoute("/_authenticated/curso/")({
  validateSearch: (search: Record<string, unknown>): { cursoId?: string } => ({
    ...(typeof search.cursoId === "string" ? { cursoId: search.cursoId } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Trilha do Curso — Informática com Jhon" },
      { name: "description", content: "Módulos e aulas organizados com capas verticais para concursos." },
    ],
  }),
  component: CursoPage,
});

export function CursoPage() {
  const { cursoId: queryCursoId } = Route.useSearch();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Modo de exibição: Grid com Capas Verticais ou Lista compacta
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const toggleModule = (modId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [modId]: !prev[modId],
    }));
  };

  const { data, isLoading } = useQuery({
    queryKey: ["curso-trilha", user?.id, isAdmin, queryCursoId],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      // 1. Buscar todos os cursos que o usuário tem acesso
      let coursesQuery = supabase.from("courses").select("*").order("position");
      if (!isAdmin) {
        coursesQuery = coursesQuery.eq("status", "published");
      }
      const coursesRes = await coursesQuery;
      const allCourses = coursesRes.data ?? [];

      let enrolledCourseIds = new Set<string>();
      if (isAdmin) {
        enrolledCourseIds = new Set(allCourses.map((c) => c.id));
      } else {
        const enrollRes = await supabase
          .from("student_courses")
          .select("course_id, status")
          .eq("student_id", user?.id || "")
          .eq("status", "active");
        enrolledCourseIds = new Set((enrollRes.data ?? []).map((e) => e.course_id));
      }

      const userCourses = allCourses.filter((c) => enrolledCourseIds.has(c.id));

      // 2. Determinar o curso ativo
      const activeCourse =
        userCourses.find((c) => c.id === queryCursoId) ??
        userCourses[0] ??
        null;

      if (!activeCourse) {
        return {
          courses: userCourses,
          activeCourse: null,
          modules: [],
          lessons: [],
          progress: [],
        };
      }

      // 3. Buscar módulos e aulas com capa vertical, assunto e parte
      const [modulesRes, lessonsRes, progressRes] = await Promise.all([
        supabase
          .from("modules")
          .select("*")
          .eq("course_id", activeCourse.id)
          .order("position"),
        supabase
          .from("lessons")
          .select("id, module_id, title, position, duration_seconds, cover_url, subject, part")
          .order("position"),
        supabase
          .from("lesson_progress")
          .select("lesson_id, completed, position_seconds")
          .eq("user_id", user?.id || ""),
      ]);

      const modules = modulesRes.data ?? [];
      const moduleIds = new Set(modules.map((m) => m.id));
      const lessons = (lessonsRes.data ?? []).filter((l) => moduleIds.has(l.module_id));
      const progress = progressRes.data ?? [];

      return {
        courses: userCourses,
        activeCourse,
        modules,
        lessons,
        progress,
      };
    },
  });

  const courses = data?.courses ?? [];
  const activeCourse = data?.activeCourse;
  const modules = data?.modules ?? [];
  const lessons = data?.lessons ?? [];
  const progress = data?.progress ?? [];

  const concluidasTotal = lessons.filter((l) =>
    progress.some((p) => p.lesson_id === l.id && p.completed)
  ).length;

  const pctGeral = lessons.length
    ? Math.round((concluidasTotal / lessons.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando trilha do curso...</p>
      </div>
    );
  }

  if (!activeCourse) {
    return (
      <div className="panel p-12 text-center">
        <GraduationCap className="mx-auto size-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-bold">Nenhum curso disponível</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Você não possui matrículas ativas em nenhum curso no momento.
        </p>
        <Link
          to="/meus-cursos"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          Ir para Meus Cursos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Navegação e Seletor de Curso */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/meus-cursos"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" /> Voltar para Meus Cursos
        </Link>

        {courses.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Alternar Curso:</span>
            <select
              value={activeCourse.id}
              onChange={(e) => {
                navigate({
                  to: "/curso",
                  search: { cursoId: e.target.value },
                });
              }}
              aria-label="Alternar Curso"
              className="rounded-lg border border-border bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Cabeçalho do Curso Ativo com Capa */}
      <header className="panel relative overflow-hidden p-6 sm:p-8 border border-zinc-800 bg-[#0c0e12]">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
              {activeCourse.category}
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">
              {modules.length} {modules.length === 1 ? "módulo" : "módulos"} · {lessons.length} aulas com capas verticais
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold sm:text-3xl text-white">
            {activeCourse.title}
          </h1>

          <p className="text-sm text-zinc-400 leading-relaxed">
            {activeCourse.description || "Curso preparatório focado no edital de informática para concursos."}
          </p>

          <div className="pt-2 max-w-md">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-zinc-400">Progresso Geral do Curso</span>
              <span className="font-bold text-blue-400">{pctGeral}%</span>
            </div>
            <ProgressBar value={pctGeral} className="h-2" />
            <p className="mt-1.5 text-[11px] text-zinc-400">
              {concluidasTotal} de {lessons.length} aulas concluídas
            </p>
          </div>
        </div>

        {activeCourse.cover_url && (
          <div className="absolute right-0 top-0 hidden h-full w-1/3 opacity-20 lg:block pointer-events-none">
            <img src={activeCourse.cover_url} alt="" className="size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0c0e12] to-transparent" />
          </div>
        )}
      </header>

      {/* Lista de Módulos e Capas Verticais das Aulas */}
      <div className="space-y-8">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <BookOpen className="size-5 text-primary" /> Módulos de Estudo
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aulas em ordem didática com capas verticais e controle de progresso
            </p>
          </div>
        </div>

        {modules.length === 0 ? (
          <div className="panel p-8 text-center text-muted-foreground">
            <p className="text-sm">Nenhum módulo cadastrado para este curso ainda.</p>
            {isAdmin && (
              <Link
                to="/admin/aulas/nova"
                search={{ cursoId: activeCourse.id }}
                className="mt-3 inline-flex items-center gap-2 text-xs text-primary underline"
              >
                Cadastrar primeira aula e módulo
              </Link>
            )}
          </div>
        ) : (
          modules.map((m, i) => {
            const aulas = lessons.filter((l) => l.module_id === m.id);
            const feitas = aulas.filter((l) =>
              progress.some((p) => p.lesson_id === l.id && p.completed)
            ).length;
            const pct = aulas.length ? Math.round((feitas / aulas.length) * 100) : 0;
            const isCollapsed = expandedModules[m.id] === false;

            return (
              <div
                key={m.id}
                className="panel overflow-hidden border border-zinc-800/80 bg-[#0c0e12] p-0 shadow-lg"
              >
                {/* Cabeçalho do Módulo */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 md:p-6 border-b border-zinc-800/60 bg-zinc-900/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] tracking-widest text-accent font-bold uppercase">
                        MÓDULO {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-xs text-zinc-400">·</span>
                      <span className="text-xs text-zinc-400 font-medium">
                        {aulas.length} {aulas.length === 1 ? "aula" : "aulas"}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-white">
                      {m.title}
                    </h3>
                    {m.description && (
                      <p className="text-xs text-zinc-400 max-w-2xl line-clamp-1">
                        {m.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-xs font-bold text-blue-400">{pct}%</span>
                      <span className="block text-[10px] text-zinc-400">
                        {feitas}/{aulas.length} concluídas
                      </span>
                    </div>

                    <Link
                      to="/curso/modulo/$moduloId"
                      params={{ moduloId: m.id }}
                      search={{ cursoId: activeCourse.id }}
                      className="rounded-xl border border-border bg-secondary/80 px-3.5 py-1.5 text-xs font-semibold hover:bg-secondary transition-colors"
                    >
                      Ver Módulo
                    </Link>

                    <button
                      onClick={() => toggleModule(m.id)}
                      className="grid size-8 place-items-center rounded-lg border border-border text-zinc-400 hover:text-white transition-colors"
                      title={isCollapsed ? "Expandir aulas" : "Recolher aulas"}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Grid das Capas Verticais das Aulas do Módulo */}
                {!isCollapsed && (
                  <div className="p-5 md:p-6">
                    {aulas.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">
                        Nenhuma aula cadastrada neste módulo ainda.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {aulas.map((aula, aIdx) => {
                          const userProg = progress.find((p) => p.lesson_id === aula.id);
                          return (
                            <LessonCard
                              key={aula.id}
                              id={aula.id}
                              title={aula.title}
                              subject={aula.subject}
                              part={aula.part}
                              coverUrl={aula.cover_url || activeCourse.cover_url}
                              durationSeconds={aula.duration_seconds}
                              completed={Boolean(userProg?.completed)}
                              positionSeconds={userProg?.position_seconds || 0}
                              position={aIdx + 1}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default CursoPage;
