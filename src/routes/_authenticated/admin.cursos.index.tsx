import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Copy,
  ExternalLink,
  GraduationCap,
  Layers,
  Loader2,
  PlusCircle,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/cursos/")({
  head: () => ({
    meta: [
      { title: "Gerenciamento de Cursos — Informática com Jhon" },
      { name: "description", content: "Administre todos os cursos da plataforma, crie novos cursos e duplique módulos." },
    ],
  }),
  component: AdminCursosIndexPage,
});

export function AdminCursosIndexPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Estados para Duplicação de Conteúdo (Item 14 da especificação)
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [sourceCourseId, setSourceCourseId] = useState<string>("");
  const [sourceModuleId, setSourceModuleId] = useState<string>("");
  const [targetCourseId, setTargetCourseId] = useState<string>("");
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateSuccess, setDuplicateSuccess] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin_courses_full"],
    enabled: isAdmin,
    queryFn: async () => {
      const [coursesRes, modulesRes, lessonsRes, studentCoursesRes] = await Promise.all([
        supabase.from("courses").select("*").order("position"),
        supabase.from("modules").select("id, title, course_id, position").order("position"),
        supabase.from("lessons").select("id, title, module_id, position").order("position"),
        supabase.from("student_courses").select("course_id, status"),
      ]);

      const courses = coursesRes.data ?? [];
      const modules = modulesRes.data ?? [];
      const lessons = lessonsRes.data ?? [];
      const studentCourses = studentCoursesRes.data ?? [];

      const enrichedCourses = courses.map((course) => {
        const cModules = modules.filter((m) => m.course_id === course.id);
        const moduleIds = new Set(cModules.map((m) => m.id));
        const cLessons = lessons.filter((l) => moduleIds.has(l.module_id));
        const activeStudents = studentCourses.filter(
          (sc) => sc.course_id === course.id && sc.status === "active"
        ).length;

        return {
          ...course,
          modules: cModules,
          modulesCount: cModules.length,
          lessonsCount: cLessons.length,
          studentsCount: activeStudents,
        };
      });

      return {
        courses: enrichedCourses,
        allModules: modules,
      };
    },
  });

  // Alternar Status Publicado / Rascunho
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      await supabase.from("courses").update({ status: newStatus }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_courses_full"] });
      queryClient.invalidateQueries({ queryKey: ["admin_multicourse_dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["meus-cursos"] });
    },
  });

  // DUPLICAR MÓDULO (Item 14: Cópia profunda independente)
  const handleDuplicateModule = async () => {
    if (!sourceModuleId || !targetCourseId || isDuplicating) return;
    setIsDuplicating(true);

    try {
      // 1. Buscar dados do módulo de origem
      const { data: sourceModule } = await supabase
        .from("modules")
        .select("*")
        .eq("id", sourceModuleId)
        .single();

      if (!sourceModule) throw new Error("Módulo de origem não encontrado.");

      // 2. Criar novo módulo no curso de destino (cópia independente)
      const { data: newModule, error: modErr } = await supabase
        .from("modules")
        .insert({
          course_id: targetCourseId,
          title: `${sourceModule.title} (Cópia)`,
          description: sourceModule.description,
          position: sourceModule.position + 10,
          published: sourceModule.published,
        })
        .select()
        .single();

      if (modErr || !newModule) throw new Error("Erro ao criar cópia do módulo.");

      // 3. Buscar aulas do módulo original
      const { data: sourceLessons } = await supabase
        .from("lessons")
        .select("*")
        .eq("module_id", sourceModuleId);

      if (sourceLessons && sourceLessons.length > 0) {
        for (const lesson of sourceLessons) {
          const { data: newLesson } = await supabase
            .from("lessons")
            .insert({
              module_id: newModule.id,
              title: lesson.title,
              description: lesson.description,
              transcript: lesson.transcript,
              video_url: lesson.video_url,
              pdf_url: lesson.pdf_url,
              duration_seconds: lesson.duration_seconds,
              position: lesson.position,
              published: lesson.published,
              transcription_status: lesson.transcription_status,
              transcript_timestamps: lesson.transcript_timestamps,
              summary: lesson.summary,
            })
            .select()
            .single();

          // 4. Buscar materiais e clonar para a nova aula
          const { data: mats } = await supabase
            .from("materials")
            .select("*")
            .eq("lesson_id", lesson.id);

          if (mats && mats.length > 0 && newLesson) {
            await supabase.from("materials").insert(
              mats.map((m) => ({
                lesson_id: newLesson.id,
                title: m.title,
                file_url: m.file_url,
              }))
            );
          }

          // 5. Buscar questões e clonar para o novo curso / módulo
          const { data: qList } = await supabase
            .from("questions")
            .select("*")
            .eq("lesson_id", lesson.id);

          if (qList && qList.length > 0 && newLesson) {
            await supabase.from("questions").insert(
              qList.map((q) => ({
                course_id: targetCourseId,
                module_id: newModule.id,
                lesson_id: newLesson.id,
                statement: q.statement,
                options: q.options,
                correct_index: q.correct_index,
                explanation: q.explanation,
                banca: q.banca,
                ano: q.ano,
                difficulty: q.difficulty,
                subject: q.subject,
              }))
            );
          }
        }
      }

      setDuplicateSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["admin_courses_full"] });
      queryClient.invalidateQueries({ queryKey: ["admin_multicourse_dashboard"] });
      setTimeout(() => {
        setDuplicateSuccess(false);
        setDuplicateModalOpen(false);
        setSourceModuleId("");
        setTargetCourseId("");
      }, 2000);
    } catch (err) {
      console.error(err);
      alert("Falha ao duplicar o módulo. Tente novamente.");
    } finally {
      setIsDuplicating(false);
    }
  };

  const courses = data?.courses ?? [];
  const allModules = data?.allModules ?? [];

  const sourceModules = allModules.filter((m) => m.course_id === sourceCourseId);

  return (
    <div className="space-y-8 pb-12">
      {/* Topo */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="size-3.5" /> Voltar ao Painel Geral
          </Link>
          <h1 className="text-2xl font-bold font-display md:text-3xl">Gerenciar Cursos da Plataforma</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Cadastre novos cursos dinamicamente, gerencie permissões e duplique conteúdos de forma independente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              if (courses.length > 0) {
                setSourceCourseId(courses[0].id);
                setTargetCourseId(courses.length > 1 ? courses[1].id : courses[0].id);
              }
              setDuplicateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3.5 py-2 text-xs font-semibold hover:bg-secondary transition-colors"
          >
            <Copy className="size-3.5" /> Duplicar Módulo
          </button>

          <Link
            to="/admin/cursos/novo"
            className="glow-primary inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            <PlusCircle className="size-4" /> NOVO CURSO
          </Link>
        </div>
      </div>

      {/* Grid de Cursos */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="panel h-72 animate-pulse bg-secondary/30" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="panel p-12 text-center">
          <GraduationCap className="mx-auto size-12 text-muted-foreground" />
          <h3 className="mt-3 text-lg font-bold">Nenhum curso cadastrado</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Comece criando seu primeiro curso de informática para concursos.
          </p>
          <Link
            to="/admin/cursos/novo"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Criar Primeiro Curso
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="panel flex flex-col justify-between overflow-hidden border transition-all hover:border-primary/50"
            >
              <div>
                {/* Capa */}
                <div className="relative aspect-video w-full bg-secondary overflow-hidden">
                  {course.cover_url ? (
                    <img
                      src={course.cover_url}
                      alt={course.title}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid size-full place-items-center bg-gradient-to-br from-primary/20 to-secondary text-primary">
                      <GraduationCap className="size-10 opacity-60" />
                    </div>
                  )}
                  <span className="absolute top-3 left-3 rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase backdrop-blur-sm">
                    {course.category}
                  </span>
                  <Badge
                    variant={course.status === "published" ? "default" : "secondary"}
                    className="absolute top-3 right-3 text-[10px] uppercase font-bold"
                  >
                    {course.status === "published" ? "Publicado" : "Rascunho"}
                  </Badge>
                </div>

                {/* Dados */}
                <div className="p-5 space-y-3">
                  <h2 className="font-display text-base font-bold truncate text-foreground">
                    {course.title}
                  </h2>
                  <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                    {course.description || "Curso preparatório de informática para concursos."}
                  </p>

                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/50 bg-secondary/30 p-2.5 text-center text-xs">
                    <div>
                      <span className="block font-bold text-foreground">{course.modulesCount}</span>
                      <span className="text-[10px] text-muted-foreground">Módulos</span>
                    </div>
                    <div>
                      <span className="block font-bold text-foreground">{course.lessonsCount}</span>
                      <span className="text-[10px] text-muted-foreground">Aulas</span>
                    </div>
                    <div>
                      <span className="block font-bold text-foreground">{course.studentsCount}</span>
                      <span className="text-[10px] text-muted-foreground">Alunos</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center justify-between border-t border-border/60 bg-secondary/20 p-3 text-xs">
                <button
                  onClick={() =>
                    toggleStatusMutation.mutate({
                      id: course.id,
                      newStatus: course.status === "published" ? "draft" : "published",
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  title="Alternar entre Rascunho e Publicado"
                >
                  {course.status === "published" ? (
                    <>
                      <ToggleRight className="size-4 text-emerald-500" />
                      <span className="text-[11px] text-emerald-500 font-semibold">Publicado</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="size-4 text-amber-500" />
                      <span className="text-[11px] text-amber-500 font-semibold">Rascunho</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <Link
                    to="/curso"
                    search={{ cursoId: course.id }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    Ver Trilha <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE DUPLICAÇÃO DE MÓDULOS (Item 14) */}
      {duplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in-50">
          <div className="panel w-full max-w-lg p-6 space-y-5 bg-card border-primary/30 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Copy className="size-5 text-primary" />
                <h3 className="font-display text-lg font-bold">Duplicar Conteúdo entre Cursos</h3>
              </div>
              <button
                onClick={() => setDuplicateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Crie uma cópia profunda e 100% independente de um módulo para outro curso. Edições futuras no módulo duplicado não alterarão o curso original.
            </p>

            <div className="space-y-4 text-xs">
              {/* Curso de Origem */}
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  1. Curso de Origem
                </label>
                <select
                  value={sourceCourseId}
                  onChange={(e) => {
                    setSourceCourseId(e.target.value);
                    setSourceModuleId("");
                  }}
                  className="w-full rounded-xl border border-border bg-background p-2.5 focus:border-primary focus:outline-none"
                >
                  <option value="">Selecione o curso de origem...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Módulo a ser duplicado */}
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  2. Módulo a Duplicar
                </label>
                <select
                  value={sourceModuleId}
                  onChange={(e) => setSourceModuleId(e.target.value)}
                  disabled={!sourceCourseId}
                  className="w-full rounded-xl border border-border bg-background p-2.5 focus:border-primary focus:outline-none disabled:opacity-50"
                >
                  <option value="">Selecione o módulo...</option>
                  {sourceModules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Curso de Destino */}
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  3. Curso de Destino (Receberá a cópia independente)
                </label>
                <select
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-2.5 focus:border-primary focus:outline-none"
                >
                  <option value="">Selecione o curso de destino...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {duplicateSuccess ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-xs font-bold text-emerald-400">
                ✓ Módulo duplicado com sucesso com todas as aulas e questões!
              </div>
            ) : (
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDuplicateModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDuplicateModule}
                  disabled={!sourceModuleId || !targetCourseId || isDuplicating}
                  className="glow-primary inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  {isDuplicating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Duplicando...
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" /> Confirmar Duplicação
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default AdminCursosIndexPage;
