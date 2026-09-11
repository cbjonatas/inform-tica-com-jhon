import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  FileText,
  FolderPlus,
  GraduationCap,
  HelpCircle,
  Layers,
  ListChecks,
  PlusCircle,
  Settings,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Painel do Professor Multicursos — Informática com Jhon" },
      { name: "description", content: "Administração da plataforma, controle de múltiplos cursos, alunos e conteúdos." },
    ],
  }),
  component: AdminIndexPage,
});

function AdminIndexPage() {
  const { isAdmin, loading } = useAuth();
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin_multicourse_dashboard"],
    enabled: isAdmin,
    queryFn: async () => {
      const [
        coursesRes,
        modulesRes,
        lessonsRes,
        profilesRes,
        questionsRes,
        attemptsRes,
        progressRes,
        studentCoursesRes,
      ] = await Promise.all([
        supabase.from("courses").select("*").order("position"),
        supabase.from("modules").select("id, title, course_id, position").order("position"),
        supabase.from("lessons").select("id, title, module_id, position").order("position"),
        supabase.from("profiles").select("id, created_at, full_name, email"),
        supabase.from("questions").select("id, statement, banca, course_id, module_id"),
        supabase.from("question_attempts").select("question_id, is_correct, user_id"),
        supabase.from("lesson_progress").select("lesson_id, user_id, completed, course_id"),
        supabase.from("student_courses").select("id, student_id, course_id, status"),
      ]);

      return {
        courses: coursesRes.data ?? [],
        modules: modulesRes.data ?? [],
        lessons: lessonsRes.data ?? [],
        profiles: profilesRes.data ?? [],
        questions: questionsRes.data ?? [],
        attempts: attemptsRes.data ?? [],
        progress: progressRes.data ?? [],
        studentCourses: studentCoursesRes.data ?? [],
      };
    },
  });

  if (loading || isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando painel do professor...</p>
      </div>
    );
  }

  const courses = data?.courses ?? [];
  const allModules = data?.modules ?? [];
  const allLessons = data?.lessons ?? [];
  const allProfiles = data?.profiles ?? [];
  const allQuestions = data?.questions ?? [];
  const allAttempts = data?.attempts ?? [];
  const allProgress = data?.progress ?? [];
  const studentCourses = data?.studentCourses ?? [];

  // Filtragem dinâmica por Curso (Item 12 da especificação)
  const isAll = selectedCourseId === "all";

  // Módulos do curso
  const filteredModules = isAll
    ? allModules
    : allModules.filter((m) => m.course_id === selectedCourseId);
  const filteredModuleIds = new Set(filteredModules.map((m) => m.id));

  // Aulas do curso
  const filteredLessons = isAll
    ? allLessons
    : allLessons.filter((l) => filteredModuleIds.has(l.module_id));
  const filteredLessonIds = new Set(filteredLessons.map((l) => l.id));

  // Questões do curso
  const filteredQuestions = isAll
    ? allQuestions
    : allQuestions.filter(
        (q) => q.course_id === selectedCourseId || filteredModuleIds.has(q.module_id || "")
      );
  const filteredQuestionIds = new Set(filteredQuestions.map((q) => q.id));

  // Alunos matriculados no curso
  const enrolledStudentIds = isAll
    ? new Set(allProfiles.map((p) => p.id))
    : new Set(
        studentCourses
          .filter((sc) => sc.course_id === selectedCourseId && sc.status === "active")
          .map((sc) => sc.student_id)
      );

  const totalAlunos = isAll ? allProfiles.length : enrolledStudentIds.size;

  // Tentativas filtradas
  const filteredAttempts = isAll
    ? allAttempts
    : allAttempts.filter((a) => a.question_id && filteredQuestionIds.has(a.question_id));

  const totalRespondidas = filteredAttempts.length;
  const acertos = filteredAttempts.filter((a) => a.is_correct).length;
  const taxaAcerto = totalRespondidas ? Math.round((acertos / totalRespondidas) * 100) : 0;

  const currentCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="space-y-8 pb-12">
      {/* Cabeçalho com Filtro de Curso (Item 12) */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">
            PAINEL ADMINISTRATIVO MULTICURSOS
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">
            Informática com Jhon — Gestão Geral
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {isAll
              ? "Exibindo estatísticas consolidadas de todos os cursos da plataforma."
              : `Exibindo dados específicos de: ${currentCourse?.title}`}
          </p>
        </div>

        {/* Seletor Dinâmico de Curso */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-4 text-primary" />
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="rounded-xl border border-primary/50 bg-secondary/80 px-3 py-2 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
            >
              <option value="all">[ TODOS OS CURSOS ]</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <Link
            to="/admin/cursos/novo"
            className="glow-primary inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            <PlusCircle className="size-3.5" /> NOVO CURSO
          </Link>
        </div>
      </header>

      {/* 4 CARDS PRINCIPAIS MULTICURSOS (Item 12 da especificação) */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Card Cursos */}
        <div className="panel p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              {isAll ? "TOTAL DE CURSOS" : "STATUS DO CURSO"}
            </span>
            <GraduationCap className="size-4 text-primary" />
          </div>
          <p className="font-display text-3xl font-bold">
            {isAll ? courses.length : currentCourse?.status === "published" ? "Publicado" : "Rascunho"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {isAll ? `${courses.filter((c) => c.status === "published").length} publicados` : currentCourse?.category}
          </p>
        </div>

        {/* Card Alunos */}
        <div className="panel p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">TOTAL DE ALUNOS</span>
            <Users className="size-4 text-primary" />
          </div>
          <p className="font-display text-3xl font-bold">{totalAlunos}</p>
          <p className="text-[11px] text-muted-foreground">
            {isAll ? "Alunos cadastrados na plataforma" : `Matriculados em ${currentCourse?.title}`}
          </p>
        </div>

        {/* Card Aulas */}
        <div className="panel p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">TOTAL DE AULAS</span>
            <Video className="size-4 text-primary" />
          </div>
          <p className="font-display text-3xl font-bold">{filteredLessons.length}</p>
          <p className="text-[11px] text-muted-foreground">
            Distribuídas em {filteredModules.length} módulos
          </p>
        </div>

        {/* Card Questões */}
        <div className="panel p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">TOTAL DE QUESTÕES</span>
            <ListChecks className="size-4 text-primary" />
          </div>
          <p className="font-display text-3xl font-bold">{filteredQuestions.length}</p>
          <p className="text-[11px] text-muted-foreground">
            {taxaAcerto}% taxa média de acertos
          </p>
        </div>
      </section>

      {/* AÇÕES RÁPIDAS DE ADMINISTRAÇÃO MULTICURSOS */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold">Gestão da Plataforma</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/admin/cursos"
            className="panel group block p-5 transition-all hover:border-primary hover:shadow-md hover:shadow-primary/5"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <GraduationCap className="size-5" />
            </div>
            <h3 className="mt-3 font-display font-semibold">Gerenciar Cursos</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Criar novos cursos, editar capas, duplicar módulos e controlar visibilidade.
            </p>
          </Link>

          <Link
            to="/admin/alunos"
            className="panel group block p-5 transition-all hover:border-primary hover:shadow-md hover:shadow-primary/5"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <UserCheck className="size-5" />
            </div>
            <h3 className="mt-3 font-display font-semibold">Alunos & Acessos</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Liberar ou bloquear o acesso de cada aluno individualmente por curso.
            </p>
          </Link>

          <Link
            to="/admin/aulas"
            className="panel group block p-5 transition-all hover:border-primary hover:shadow-md hover:shadow-primary/5"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Video className="size-5" />
            </div>
            <h3 className="mt-3 font-display font-semibold">Gerenciar Aulas</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Cadastrar novas videoaulas com IA em 1 clique, PDFs e transcrições.
            </p>
          </Link>

          <Link
            to="/admin/modulos"
            className="panel group block p-5 transition-all hover:border-primary hover:shadow-md hover:shadow-primary/5"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <FolderPlus className="size-5" />
            </div>
            <h3 className="mt-3 font-display font-semibold">Estrutura de Módulos</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Organizar a ordem cronológica dos módulos de cada curso.
            </p>
          </Link>
        </div>
      </section>

      {/* LISTAGEM DOS CURSOS ATIVOS NO PAINEL */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Cursos Cadastrados ({courses.length})</h2>
          <Link to="/admin/cursos" className="text-xs font-semibold text-primary hover:underline">
            Ver painel detalhado de cursos &rarr;
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((c) => {
            const cModules = allModules.filter((m) => m.course_id === c.id);
            const cLessons = allLessons.filter((l) => cModules.some((m) => m.id === l.module_id));
            const cStudents = studentCourses.filter((sc) => sc.course_id === c.id && sc.status === "active").length;

            return (
              <div key={c.id} className="panel flex flex-col justify-between p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {c.category}
                    </Badge>
                    <span
                      className={`size-2 rounded-full ${
                        c.status === "published" ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                  </div>
                  <h3 className="mt-2 font-display text-sm font-bold truncate">{c.title}</h3>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                    {c.description || "Sem descrição informada."}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/50 bg-secondary/30 p-2 text-center text-[10px]">
                  <div>
                    <span className="block font-bold">{cModules.length}</span>
                    <span className="text-muted-foreground">Mód</span>
                  </div>
                  <div>
                    <span className="block font-bold">{cLessons.length}</span>
                    <span className="text-muted-foreground">Aulas</span>
                  </div>
                  <div>
                    <span className="block font-bold">{cStudents}</span>
                    <span className="text-muted-foreground">Alunos</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
export default AdminIndexPage;
