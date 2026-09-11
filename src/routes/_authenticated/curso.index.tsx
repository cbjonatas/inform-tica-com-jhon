import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, BookOpen, ChevronRight, GraduationCap, LayoutList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ProgressBar } from "@/components/ProgressBar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/curso/")({
  validateSearch: (search: Record<string, unknown>) => ({
    cursoId: typeof search.cursoId === "string" ? search.cursoId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Trilha do Curso — Informática com Jhon" },
      { name: "description", content: "Módulos e aulas organizados conforme o edital do curso." },
    ],
  }),
  component: CursoPage,
});

function CursoPage() {
  const { cursoId: queryCursoId } = Route.useSearch();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

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

      // 3. Buscar módulos e aulas estritamente desse curso
      const [modulesRes, lessonsRes, progressRes] = await Promise.all([
        supabase
          .from("modules")
          .select("*")
          .eq("course_id", activeCourse.id)
          .order("position"),
        supabase
          .from("lessons")
          .select("id, module_id, title, position, duration_seconds")
          .order("position"),
        supabase
          .from("lesson_progress")
          .select("lesson_id, completed")
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
    <div className="space-y-6 pb-12">
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

      {/* Cabeçalho do Curso Ativo */}
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs">
              {activeCourse.category}
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">
              {modules.length} {modules.length === 1 ? "módulo" : "módulos"} · {lessons.length} aulas
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold sm:text-3xl text-foreground">
            {activeCourse.title}
          </h1>

          <p className="text-sm text-muted-foreground">
            {activeCourse.description || "Curso preparatório focado no edital de informática para concursos."}
          </p>

          <div className="pt-2 max-w-md">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Progresso do Curso</span>
              <span className="font-bold text-primary">{pctGeral}%</span>
            </div>
            <ProgressBar value={pctGeral} className="h-2" />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {concluidasTotal} de {lessons.length} aulas concluídas
            </p>
          </div>
        </div>

        {activeCourse.cover_url && (
          <div className="absolute right-0 top-0 hidden h-full w-1/3 opacity-20 lg:block pointer-events-none">
            <img src={activeCourse.cover_url} alt="" className="size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-card to-transparent" />
          </div>
        )}
      </header>

      {/* Lista de Módulos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Módulos de Estudo</h2>
          <span className="text-xs text-muted-foreground">Estude na ordem recomendada</span>
        </div>

        {modules.length === 0 ? (
          <div className="panel p-8 text-center text-muted-foreground">
            <p className="text-sm">Nenhum módulo cadastrado para este curso ainda.</p>
            {isAdmin && (
              <Link
                to="/admin/modulos"
                className="mt-3 inline-flex items-center gap-2 text-xs text-primary underline"
              >
                Cadastrar módulos no painel admin
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

            return (
              <Link
                key={m.id}
                to="/curso/modulo/$moduloId"
                params={{ moduloId: m.id }}
                search={{ cursoId: activeCourse.id }}
                className="panel group block p-6 transition-all hover:border-primary hover:shadow-md hover:shadow-primary/5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] tracking-widest text-muted-foreground font-bold uppercase">
                    MÓDULO {String(i + 1).padStart(2, "0")}
                  </p>
                  <span className="text-xs font-bold text-primary">{pct}% concluído</span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-4">
                  <h3 className="font-display text-lg font-semibold group-hover:text-primary transition-colors">
                    {m.title}
                  </h3>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>

                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{m.description}</p>
                <ProgressBar value={pct} className="mt-4 h-1.5" />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {feitas} de {aulas.length} aulas concluídas
                </p>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
export default CursoPage;
