import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CourseCard } from "@/components/CourseCard";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/meus-cursos")({
  head: () => ({
    meta: [
      { title: "Meus Cursos — Informática com Jhon" },
      {
        name: "description",
        content: "Acesse todos os cursos de Informática para Concursos aos quais você possui acesso.",
      },
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
      // 1. Buscar cursos disponíveis
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

      // Mapear estatísticas por curso
      const coursesWithStats = allCourses
        .filter((c) => enrolledCourseIds.has(c.id))
        .map((course) => {
          const courseModules = modules.filter((m) => m.course_id === course.id);
          const moduleIds = new Set(courseModules.map((m) => m.id));
          const courseLessons = lessons.filter((l) => moduleIds.has(l.module_id));

          const completedCount = courseLessons.filter((l) =>
            progress.some((p) => p.lesson_id === l.id && p.completed)
          ).length;

          // Se tiver aulas no banco, calcula a porcentagem real; caso contrário, 0%
          const pct = courseLessons.length
            ? Math.round((completedCount / courseLessons.length) * 100)
            : 0;

          // Definir quantidade de aulas (com base real ou nos valores de referência da plataforma)
          let totalAulas = courseLessons.length;
          if (totalAulas === 0) {
            if (course.title.includes("PMBA")) totalAulas = 23;
            else if (course.title.includes("Questões")) totalAulas = 10;
            else totalAulas = 12;
          }

          return {
            ...course,
            modulesCount: courseModules.length,
            lessonsCount: totalAulas,
            completedCount,
            pct,
          };
        });

      return {
        courses: coursesWithStats,
        totalEnrolled: coursesWithStats.length,
      };
    },
  });

  const courses = data?.courses ?? [];

  // Agrupar cursos por categoria (ex: Informática - PMBA, Carreiras Policiais, etc.)
  const categoriesMap = courses.reduce(
    (acc, course) => {
      const cat = course.category?.trim() || "Cursos Gerais";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(course);
      return acc;
    },
    {} as Record<string, typeof courses>
  );

  const categories = Object.keys(categoriesMap);

  return (
    <div className="space-y-10 pb-16">
      {/* Cabeçalho da Área de Membros */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-6">
        <div>
          <p className="text-xs font-bold tracking-[0.25em] text-accent uppercase">
            Área de Membros do Aluno
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Meus Cursos Comprados
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Acesse as aulas em vídeo, materiais de apoio e simulados dos seus cursos ativos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="outline"
            className="border-blue-500/40 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400"
          >
            {courses.length} {courses.length === 1 ? "curso disponível" : "cursos disponíveis"}
          </Badge>

          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <ShieldCheck className="size-4" />
              Painel Admin
            </Link>
          )}
        </div>
      </header>

      {/* Estados de Carregamento e Vazio */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="aspect-[9/13] animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60"
            />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-[#0c0e12] p-12 text-center shadow-xl">
          <div className="grid size-16 place-items-center rounded-2xl bg-zinc-900 text-blue-500">
            <BookOpen className="size-8" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-white">Nenhum curso matriculado no momento</h3>
          <p className="mt-2 max-w-md text-sm text-zinc-400">
            Você ainda não possui matrículas ativas em cursos. Caso tenha adquirido um curso recentemente,
            aguarde alguns instantes ou entre em contato com o suporte do Prof. Jhon.
          </p>
        </div>
      ) : (
        /* Seções de Cursos no Estilo da Imagem (Ex: Informática - PMBA) */
        <div className="space-y-12">
          {categories.map((categoryTitle) => {
            const categoryCourses = categoriesMap[categoryTitle];
            if (!categoryCourses || categoryCourses.length === 0) return null;

            return (
              <section key={categoryTitle} className="space-y-4">
                {/* Título da Seção no estilo exato da imagem de referência */}
                <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">
                  {categoryTitle}
                </h2>

                {/* Grid dos Cards Verticais Estilo Poster */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {categoryCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      id={course.id}
                      title={course.title}
                      coverUrl={course.cover_url}
                      lessonsCount={course.lessonsCount}
                      pct={course.pct}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MeusCursosPage;
