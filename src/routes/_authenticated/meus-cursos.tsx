import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, ChevronRight, Clock, FolderGit2, GraduationCap, Play, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ProgressBar } from "@/components/ProgressBar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/meus-cursos")({
  head: () => ({
    meta: [
      { title: "Meus Cursos — Informática com Jhon" },
      { name: "description", content: "Acesse todos os cursos de Informática para Concursos aos quais você possui acesso." },
    ],
  }),
  component: MeusCursosPage,
});

export function MeusCursosPage() {
  const { user, isAdmin } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["meus-cursos", user?.id, isAdmin],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      // 1. Buscar cursos disponíveis para o usuário
      let coursesQuery = supabase
        .from("courses")
        .select("*")
        .order("position", { ascending: true });

      if (!isAdmin) {
        coursesQuery = coursesQuery.eq("status", "published");
      }

      const coursesRes = await coursesQuery;
      const allCourses = coursesRes.data ?? [];

      // 2. Buscar matrículas do aluno se não for admin
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

      // 3. Buscar módulos e aulas de todos os cursos
      const [modulesRes, lessonsRes, progressRes] = await Promise.all([
        supabase.from("modules").select("id, title, course_id, position").order("position"),
        supabase.from("lessons").select("id, title, module_id, position, duration_seconds").order("position"),
        supabase
          .from("lesson_progress")
          .select("lesson_id, course_id, completed, updated_at")
          .order("updated_at", { ascending: false }),
      ]);

      const modules = modulesRes.data ?? [];
      const lessons = lessonsRes.data ?? [];
      const progress = progressRes.data ?? [];

      // Mapear métricas por curso
      const coursesWithStats = allCourses
        .filter((c) => enrolledCourseIds.has(c.id))
        .map((course) => {
          const courseModules = modules.filter((m) => m.course_id === course.id);
          const moduleIds = new Set(courseModules.map((m) => m.id));
          const courseLessons = lessons.filter((l) => moduleIds.has(l.module_id));
          const lessonIds = new Set(courseLessons.map((l) => l.id));

          const completedCount = courseLessons.filter((l) =>
            progress.some((p) => p.lesson_id === l.id && p.completed)
          ).length;

          const pct = courseLessons.length
            ? Math.round((completedCount / courseLessons.length) * 100)
            : 0;

          // Última aula assistida neste curso
          const lastWatchedProgress = progress.find((p) => lessonIds.has(p.lesson_id));
          const lastWatchedLesson = lastWatchedProgress
            ? courseLessons.find((l) => l.id === lastWatchedProgress.lesson_id)
            : courseLessons[0] || null;

          return {
            ...course,
            modulesCount: courseModules.length,
            lessonsCount: courseLessons.length,
            completedCount,
            pct,
            lastWatchedLesson,
          };
        });

      return {
        courses: coursesWithStats,
        totalEnrolled: coursesWithStats.length,
      };
    },
  });

  const courses = data?.courses ?? [];

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-accent">PLATAFORMA MULTICURSOS</p>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">Meus Cursos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha um dos seus cursos ativos para retomar seus estudos de Informática.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
            {courses.length} {courses.length === 1 ? "curso matriculado" : "cursos matriculados"}
          </Badge>
          {isAdmin && (
            <Link
              to="/admin/cursos/novo"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              + Criar Novo Curso
            </Link>
          )}
        </div>
      </header>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="panel h-80 animate-pulse bg-secondary/30" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center p-12 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-secondary text-primary">
            <BookOpen className="size-8" />
          </div>
          <h3 className="mt-4 text-xl font-bold">Nenhum curso matriculado no momento</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Você ainda não possui matrículas ativas em cursos específicos. Caso tenha adquirido um curso recentemente, entre em contato com o suporte ou aguarde a liberação do professor Jhon.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="panel group flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5"
            >
              {/* Capa do Curso */}
              <div className="relative aspect-video w-full overflow-hidden bg-secondary">
                {course.cover_url ? (
                  <img
                    src={course.cover_url}
                    alt={course.title}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="grid size-full place-items-center bg-gradient-to-br from-primary/20 to-secondary text-primary">
                    <GraduationCap className="size-12 opacity-50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
                <span className="absolute top-3 left-3 rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md">
                  {course.category}
                </span>
                <span className="absolute top-3 right-3 rounded-md bg-primary/90 px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                  {course.pct}% Concluído
                </span>
                <div className="absolute right-3 bottom-3 left-3">
                  <h2 className="font-display text-lg font-bold text-foreground drop-shadow-sm">
                    {course.title}
                  </h2>
                </div>
              </div>

              {/* Informações e Progresso */}
              <div className="flex flex-1 flex-col justify-between p-5">
                <div className="space-y-3">
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {course.description || "Curso preparatório focado no edital de informática para concursos."}
                  </p>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progresso do Curso</span>
                      <span className="font-bold text-primary">{course.pct}%</span>
                    </div>
                    <ProgressBar value={course.pct} className="h-2" />
                    <p className="text-[11px] text-muted-foreground">
                      {course.completedCount} de {course.lessonsCount} aulas concluídas
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-secondary/30 p-2 text-center text-xs">
                    <div>
                      <span className="block font-bold text-foreground">{course.modulesCount}</span>
                      <span className="text-[10px] text-muted-foreground">Módulos</span>
                    </div>
                    <div>
                      <span className="block font-bold text-foreground">{course.lessonsCount}</span>
                      <span className="text-[10px] text-muted-foreground">Aulas</span>
                    </div>
                  </div>

                  {course.lastWatchedLesson && (
                    <div className="rounded-lg border border-border/40 bg-secondary/20 p-2.5 text-xs">
                      <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Última aula acessada
                      </span>
                      <span className="mt-0.5 block truncate font-medium text-foreground">
                        {course.lastWatchedLesson.title}
                      </span>
                    </div>
                  )}
                </div>

                {/* Botões de Ação */}
                <div className="mt-5 flex items-center gap-2 pt-2">
                  <Link
                    to="/curso"
                    search={{ cursoId: course.id }}
                    className="glow-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-95"
                  >
                    <Play className="size-3.5 fill-current" />
                    CONTINUAR
                  </Link>

                  <Link
                    to="/curso"
                    search={{ cursoId: course.id }}
                    title="Ver grade completa do curso"
                    className="rounded-xl border border-border bg-secondary/60 p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default MeusCursosPage;
