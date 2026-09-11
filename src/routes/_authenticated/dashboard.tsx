import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, GraduationCap, Play, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ProgressBar } from "@/components/ProgressBar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard do aluno — Informática com Jhon" },
      { name: "description", content: "Acompanhe seus cursos, progresso independente e retome seus estudos." },
      { property: "og:title", content: "Dashboard do aluno — Informática com Jhon" },
      { property: "og:description", content: "Painel de estudos multicursos de Informática para concursos." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, user, isAdmin } = useAuth();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-multicourse", user?.id, isAdmin],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      // 1. Buscar cursos disponíveis
      const coursesRes = await supabase
        .from("courses")
        .select("*")
        .order("position", { ascending: true });

      const allCourses = coursesRes.data ?? [];

      // 2. Identificar matrículas do aluno
      let enrolledCourseIds = new Set<string>();
      if (isAdmin) {
        enrolledCourseIds = new Set(allCourses.map((c) => c.id));
      } else {
        const studentCoursesRes = await supabase
          .from("student_courses")
          .select("course_id, status")
          .eq("student_id", user?.id || "")
          .eq("status", "active");

        enrolledCourseIds = new Set((studentCoursesRes.data ?? []).map((sc) => sc.course_id));
      }

      const enrolledCourses = allCourses.filter((c) => enrolledCourseIds.has(c.id));

      // 3. Buscar módulos, aulas, progresso e tentativas
      const [modulesRes, lessonsRes, progressRes, attemptsRes] = await Promise.all([
        supabase.from("modules").select("*").order("position"),
        supabase.from("lessons").select("id, title, module_id, position, duration_seconds").order("position"),
        supabase
          .from("lesson_progress")
          .select("lesson_id, course_id, completed, position_seconds, updated_at")
          .order("updated_at", { ascending: false }),
        supabase.from("question_attempts").select("is_correct, question_id"),
      ]);

      const modules = modulesRes.data ?? [];
      const lessons = lessonsRes.data ?? [];
      const progress = progressRes.data ?? [];
      const attempts = attemptsRes.data ?? [];

      // Calcular estatísticas isoladas por curso
      const coursesWithStats = enrolledCourses.map((course) => {
        const courseModules = modules.filter((m) => m.course_id === course.id);
        const moduleIds = new Set(courseModules.map((m) => m.id));
        const courseLessons = lessons.filter((l) => moduleIds.has(l.module_id));
        const lessonIds = new Set(courseLessons.map((l) => l.id));

        const concluidas = courseLessons.filter((l) =>
          progress.some((p) => p.lesson_id === l.id && p.completed)
        ).length;

        const pct = courseLessons.length
          ? Math.round((concluidas / courseLessons.length) * 100)
          : 0;

        const lastProgress = progress.find((p) => lessonIds.has(p.lesson_id));
        const lastLesson = lastProgress
          ? courseLessons.find((l) => l.id === lastProgress.lesson_id)
          : courseLessons[0] || null;

        return {
          ...course,
          modules: courseModules,
          lessons: courseLessons,
          concluidas,
          totalLessons: courseLessons.length,
          pct,
          lastLesson,
        };
      });

      return {
        courses: coursesWithStats,
        allModules: modules,
        allLessons: lessons,
        allProgress: progress,
        attempts,
      };
    },
  });

  const courses = data?.courses ?? [];
  const activeCourse =
    courses.find((c) => c.id === selectedCourseId) ?? courses[0] ?? null;

  const attempts = data?.attempts ?? [];
  const acertos = attempts.filter((a) => a.is_correct).length;
  const taxa = attempts.length ? Math.round((acertos / attempts.length) * 100) : 0;

  const primeiroNome = (profile?.full_name || "").split(" ")[0] || "aluno";

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-accent">ÁREA DO ALUNO</p>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">Olá, {primeiroNome}!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe seu avanço em cada curso e continue sua preparação com Jhon.
          </p>
        </div>

        <Link
          to="/meus-cursos"
          className="inline-flex items-center gap-2 text-xs font-semibold text-primary transition-opacity hover:underline"
        >
          Ver todos os meus cursos <ChevronRight className="size-4" />
        </Link>
      </header>

      {/* SEÇÃO PRINCIPAL: MEUS CURSOS (Item 7 da especificação) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" />
            <h2 className="font-display text-lg font-bold">MEUS CURSOS</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {courses.length} {courses.length === 1 ? "curso ativo" : "cursos ativos"}
          </span>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="panel h-40 animate-pulse bg-secondary/30" />
            <div className="panel h-40 animate-pulse bg-secondary/30" />
          </div>
        ) : courses.length === 0 ? (
          <div className="panel p-6 text-center text-muted-foreground">
            <p className="text-sm">Você ainda não está matriculado em nenhum curso.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const isActive = activeCourse?.id === course.id;
              return (
                <div
                  key={course.id}
                  onClick={() => setSelectedCourseId(course.id)}
                  className={`panel relative flex flex-col justify-between p-5 cursor-pointer transition-all ${
                    isActive
                      ? "border-primary shadow-md shadow-primary/10 ring-1 ring-primary"
                      : "hover:border-primary/50"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                        {course.category}
                      </span>
                      <span className="font-display text-xs font-bold text-primary">
                        {course.pct}% concluído
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-base font-bold text-foreground">
                      {course.title}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {course.description}
                    </p>

                    <ProgressBar value={course.pct} className="mt-3 h-2" />
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {course.concluidas} de {course.totalLessons} aulas concluídas
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                    <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                      {course.lastLesson ? course.lastLesson.title : "Início do curso"}
                    </span>
                    <Link
                      to="/curso"
                      search={{ cursoId: course.id }}
                      onClick={(e) => e.stopPropagation()}
                      className="glow-primary inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      <Play className="size-3 fill-current" />
                      CONTINUAR
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* DETALHES DO CURSO SELECIONADO */}
      {activeCourse && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <p className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">
                VISUALIZANDO TRILHA DO CURSO
              </p>
              <h2 className="font-display text-xl font-bold text-foreground">
                {activeCourse.title}
              </h2>
            </div>
            <Link
              to="/curso"
              search={{ cursoId: activeCourse.id }}
              className="glow-primary inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              <Play className="size-3.5 fill-current" /> Acessar Curso Completo
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="panel p-4">
              <p className="font-display text-2xl font-bold text-primary">{activeCourse.pct}%</p>
              <p className="mt-1 text-xs text-muted-foreground">Progresso neste curso</p>
            </div>
            <div className="panel p-4">
              <p className="font-display text-2xl font-bold">{activeCourse.concluidas} / {activeCourse.totalLessons}</p>
              <p className="mt-1 text-xs text-muted-foreground">Aulas concluídas</p>
            </div>
            <div className="panel p-4">
              <p className="font-display text-2xl font-bold">{activeCourse.modules.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Módulos no curso</p>
            </div>
            <div className="panel p-4">
              <p className="font-display text-2xl font-bold">{taxa}%</p>
              <p className="mt-1 text-xs text-muted-foreground">Taxa geral de acertos</p>
            </div>
          </div>

          {/* Módulos do Curso Selecionado */}
          <div className="space-y-3">
            <h3 className="font-display text-base font-semibold">Módulos de {activeCourse.title}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {activeCourse.modules.map((m, idx) => {
                const aulasDoModulo = activeCourse.lessons.filter((l) => l.module_id === m.id);
                const feitas = aulasDoModulo.filter((l) =>
                  (data?.allProgress ?? []).some((p) => p.lesson_id === l.id && p.completed)
                ).length;
                const p = aulasDoModulo.length ? Math.round((feitas / aulasDoModulo.length) * 100) : 0;

                return (
                  <Link
                    key={m.id}
                    to="/curso/modulo/$moduloId"
                    params={{ moduloId: m.id }}
                    search={{ cursoId: activeCourse.id }}
                    className="panel block p-5 transition-colors hover:border-primary"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] tracking-widest text-muted-foreground font-bold">
                        MÓDULO {String(idx + 1).padStart(2, "0")}
                      </p>
                      <span className="text-xs font-bold text-primary">{p}%</span>
                    </div>
                    <h4 className="mt-1 font-display text-base font-semibold">{m.title}</h4>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.description}</p>
                    <ProgressBar value={p} className="mt-3 h-1.5" />
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {feitas} de {aulasDoModulo.length} aulas concluídas
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Banner IA do Jhon */}
      <Link
        to="/ia"
        search={activeCourse ? { cursoId: activeCourse.id } : undefined}
        className="panel flex items-center gap-4 p-5 transition-colors hover:border-primary"
      >
        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <Sparkles className="size-6" />
        </div>
        <div className="flex-1">
          <p className="font-display font-semibold">Tire dúvidas com a IA do Jhon</p>
          <p className="text-xs text-muted-foreground">
            Resumos inteligentes, explicações e simulações focadas no edital do seu curso.
          </p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
    </div>
  );
}
export default Dashboard;
