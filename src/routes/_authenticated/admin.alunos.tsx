import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
  Unlock,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ProgressBar";

export const Route = createFileRoute("/_authenticated/admin/alunos")({
  head: () => ({
    meta: [
      { title: "Administração de Alunos — Informática com Jhon" },
      { name: "description", content: "Gerencie matrículas, libere acessos a cursos específicos e visualize progresso dos alunos." },
    ],
  }),
  component: AdminAlunosPage,
});

export function AdminAlunosPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin_students_and_courses"],
    enabled: isAdmin,
    queryFn: async () => {
      const [profilesRes, coursesRes, studentCoursesRes, progressRes, lessonsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("courses").select("id, title, category").order("position"),
        supabase.from("student_courses").select("*"),
        supabase.from("lesson_progress").select("user_id, lesson_id, course_id, completed"),
        supabase.from("lessons").select("id, module_id, modules(course_id)"),
      ]);

      const profiles = profilesRes.data ?? [];
      const courses = coursesRes.data ?? [];
      const studentCourses = studentCoursesRes.data ?? [];
      const progress = progressRes.data ?? [];
      const lessons = lessonsRes.data ?? [];

      // Mapear aulas por curso
      const lessonsPerCourse: Record<string, string[]> = {};
      courses.forEach((c) => {
        lessonsPerCourse[c.id] = [];
      });

      lessons.forEach((l: any) => {
        const cId = l.modules?.course_id;
        if (cId && lessonsPerCourse[cId]) {
          lessonsPerCourse[cId].push(l.id);
        }
      });

      return {
        profiles,
        courses,
        studentCourses,
        progress,
        lessonsPerCourse,
      };
    },
  });

  // Mutação para Adicionar / Remover Acesso a um Curso
  const toggleCourseAccessMutation = useMutation({
    mutationFn: async ({
      studentId,
      courseId,
      hasAccess,
    }: {
      studentId: string;
      courseId: string;
      hasAccess: boolean;
    }) => {
      if (hasAccess) {
        // Remover acesso
        await supabase
          .from("student_courses")
          .delete()
          .eq("student_id", studentId)
          .eq("course_id", courseId);
      } else {
        // Adicionar acesso
        await supabase.from("student_courses").insert({
          student_id: studentId,
          course_id: courseId,
          status: "active",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_students_and_courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin_multicourse_dashboard"] });
    },
  });

  // Mutação para Bloquear / Desbloquear Aluno em um Curso
  const toggleBlockMutation = useMutation({
    mutationFn: async ({
      studentId,
      courseId,
      currentStatus,
    }: {
      studentId: string;
      courseId: string;
      currentStatus: string;
    }) => {
      const newStatus = currentStatus === "active" ? "blocked" : "active";
      await supabase
        .from("student_courses")
        .update({ status: newStatus })
        .eq("student_id", studentId)
        .eq("course_id", courseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_students_and_courses"] });
    },
  });

  const profiles = data?.profiles ?? [];
  const courses = data?.courses ?? [];
  const studentCourses = data?.studentCourses ?? [];
  const progress = data?.progress ?? [];
  const lessonsPerCourse = data?.lessonsPerCourse ?? {};

  const filteredProfiles = profiles.filter((p) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (p.full_name || "").toLowerCase().includes(term) ||
      (p.email || "").toLowerCase().includes(term) ||
      (p.whatsapp || "").toLowerCase().includes(term)
    );
  });

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
          <h1 className="text-2xl font-bold font-display md:text-3xl">Alunos & Controle de Acesso</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Defina quais alunos possuem acesso a quais cursos de informática e acompanhe o progresso independente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {profiles.length} alunos cadastrados
          </Badge>
        </div>
      </div>

      {/* Barra de Pesquisa */}
      <div className="panel p-4 flex items-center gap-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar aluno por nome, e-mail ou WhatsApp..."
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Tabela de Alunos e Cursos (Item 10 da especificação) */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">Aluno</th>
                <th className="p-4">Contato</th>
                <th className="p-4">Cursos com Acesso & Progresso</th>
                <th className="p-4 text-right">Data de Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground animate-pulse">
                    Carregando alunos e matrículas...
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Nenhum aluno encontrado.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((student) => {
                  const studentEnrollments = studentCourses.filter(
                    (sc) => sc.student_id === student.id
                  );

                  return (
                    <tr key={student.id} className="hover:bg-secondary/20 transition-colors">
                      {/* Nome e E-mail */}
                      <td className="p-4 align-top">
                        <div className="font-semibold text-foreground text-sm">
                          {student.full_name || "Sem Nome"}
                        </div>
                        <div className="text-muted-foreground">{student.email}</div>
                      </td>

                      {/* WhatsApp / Contato */}
                      <td className="p-4 align-top text-muted-foreground">
                        {student.whatsapp || "Não informado"}
                      </td>

                      {/* Checkboxes de Acesso por Curso */}
                      <td className="p-4 align-top">
                        <div className="space-y-2.5">
                          {courses.map((course) => {
                            const enrollment = studentEnrollments.find(
                              (sc) => sc.course_id === course.id
                            );
                            const hasAccess = Boolean(enrollment);
                            const isBlocked = enrollment?.status === "blocked";

                            // Calcular progresso do aluno neste curso
                            const courseLessonIds = lessonsPerCourse[course.id] || [];
                            const completedCount = progress.filter(
                              (p) =>
                                p.user_id === student.id &&
                                courseLessonIds.includes(p.lesson_id) &&
                                p.completed
                            ).length;
                            const pct = courseLessonIds.length
                              ? Math.round((completedCount / courseLessonIds.length) * 100)
                              : 0;

                            return (
                              <div
                                key={course.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2"
                              >
                                <div className="flex items-center gap-2 min-w-[200px]">
                                  <input
                                    type="checkbox"
                                    id={`access-${student.id}-${course.id}`}
                                    checked={hasAccess}
                                    onChange={() =>
                                      toggleCourseAccessMutation.mutate({
                                        studentId: student.id,
                                        courseId: course.id,
                                        hasAccess,
                                      })
                                    }
                                    className="size-4 rounded accent-primary cursor-pointer"
                                  />
                                  <label
                                    htmlFor={`access-${student.id}-${course.id}`}
                                    className={`font-semibold cursor-pointer select-none text-xs ${
                                      hasAccess ? "text-foreground" : "text-muted-foreground line-through opacity-70"
                                    }`}
                                  >
                                    {course.title}
                                  </label>
                                </div>

                                {hasAccess && (
                                  <div className="flex items-center gap-3 text-[11px]">
                                    {/* Progresso do aluno neste curso */}
                                    <div className="flex items-center gap-1.5 min-w-[100px]">
                                      <span className="font-bold text-primary">{pct}%</span>
                                      <ProgressBar value={pct} className="w-16 h-1.5" />
                                    </div>

                                    {/* Botão de Bloquear / Liberar */}
                                    <button
                                      onClick={() =>
                                        toggleBlockMutation.mutate({
                                          studentId: student.id,
                                          courseId: course.id,
                                          currentStatus: enrollment.status,
                                        })
                                      }
                                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold transition-colors ${
                                        isBlocked
                                          ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                                          : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                      }`}
                                      title={isBlocked ? "Liberar acesso" : "Bloquear aluno neste curso"}
                                    >
                                      {isBlocked ? (
                                        <>
                                          <Lock className="size-3" /> Bloqueado
                                        </>
                                      ) : (
                                        <>
                                          <Unlock className="size-3" /> Ativo
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Data de Cadastro */}
                      <td className="p-4 align-top text-right text-muted-foreground">
                        {new Date(student.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default AdminAlunosPage;
