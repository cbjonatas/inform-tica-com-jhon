import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Edit,
  GraduationCap,
  Loader2,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isEmailAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ProgressBar";

export const Route = createFileRoute("/_authenticated/admin/alunos")({
  head: () => ({
    meta: [
      { title: "Administração de Alunos — Informática com Jhon" },
      { name: "description", content: "Gerencie matrículas, cadastre alunos e controle acessos aos cursos." },
    ],
  }),
  component: AdminAlunosPage,
});

export function AdminAlunosPage() {
  const { user, profile, isAdmin: authIsAdmin } = useAuth();
  const queryClient = useQueryClient();

  const userEmail = (user?.email || user?.user_metadata?.email || profile?.email || "").toLowerCase().trim();
  const userName = (user?.user_metadata?.full_name || profile?.full_name || "").toLowerCase().trim();
  const isAdmin =
    Boolean(authIsAdmin) ||
    isEmailAdmin(userEmail) ||
    isEmailAdmin(profile?.email) ||
    userName.includes("professorjonatas");

  const [searchTerm, setSearchTerm] = useState("");

  // Estados de Criação / Edição de Aluno
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState({
    full_name: "",
    email: "",
    whatsapp: "",
    initialCourseIds: [] as string[],
  });

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
        if (cId) {
          const list = lessonsPerCourse[cId];
          if (list) {
            list.push(l.id);
          }
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

  // Mutação para Cadastrar / Editar Aluno
  const saveStudentMutation = useMutation({
    mutationFn: async () => {
      if (!studentForm.full_name.trim() || !studentForm.email.trim()) {
        throw new Error("Nome e E-mail são campos obrigatórios.");
      }

      if (editingStudentId) {
        // Atualizar
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: studentForm.full_name.trim(),
            email: studentForm.email.trim().toLowerCase(),
            whatsapp: studentForm.whatsapp.trim(),
          })
          .eq("id", editingStudentId);
        if (error) throw error;
      } else {
        // Cadastrar novo
        const newStudentId = crypto.randomUUID();
        const { error: profileErr } = await supabase.from("profiles").insert({
          id: newStudentId,
          full_name: studentForm.full_name.trim(),
          email: studentForm.email.trim().toLowerCase(),
          whatsapp: studentForm.whatsapp.trim(),
        });
        if (profileErr) throw profileErr;

        if (studentForm.initialCourseIds.length > 0) {
          const enrollments = studentForm.initialCourseIds.map((courseId) => ({
            student_id: newStudentId,
            course_id: courseId,
            status: "active",
          }));
          const { error: enrollErr } = await supabase.from("student_courses").insert(enrollments);
          if (enrollErr) console.warn("Erro ao vincular cursos iniciais:", enrollErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_students_and_courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin_central_data"] });
      toast.success(editingStudentId ? "Dados do aluno atualizados!" : "Novo aluno cadastrado!");
      setStudentModalOpen(false);
      setEditingStudentId(null);
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar aluno", { description: err.message });
    },
  });

  // Mutação para Remover Aluno
  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      await supabase.from("student_courses").delete().eq("student_id", studentId);
      await supabase.from("lesson_progress").delete().eq("user_id", studentId);
      const { error } = await supabase.from("profiles").delete().eq("id", studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_students_and_courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin_central_data"] });
      toast.success("Aluno removido da plataforma.");
    },
    onError: (err: any) => {
      toast.error("Erro ao remover aluno", { description: err.message });
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
        const { error } = await supabase
          .from("student_courses")
          .delete()
          .eq("student_id", studentId)
          .eq("course_id", courseId);
        if (error) throw error;
      } else {
        // Adicionar acesso
        const { error } = await supabase.from("student_courses").insert({
          student_id: studentId,
          course_id: courseId,
          status: "active",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_students_and_courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin_central_data"] });
      toast.success("Matrícula atualizada com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao alterar matrícula", { description: err.message });
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
      const { error } = await supabase
        .from("student_courses")
        .update({ status: newStatus })
        .eq("student_id", studentId)
        .eq("course_id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_students_and_courses"] });
      toast.success("Status de acesso alterado!");
    },
    onError: (err: any) => {
      toast.error("Erro ao alterar status", { description: err.message });
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

  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center space-y-4 max-w-md mx-auto my-12 border-rose-500/30">
        <div className="grid size-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-500 mx-auto">
          <Lock className="size-6" />
        </div>
        <h2 className="text-xl font-bold font-display text-foreground">Acesso Restrito ao Administrador</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Esta tela é restrita exclusivamente ao administrador oficial (<strong>professorjonatasg@gmail.com</strong>).
        </p>
        <Link
          to="/meus-cursos"
          className="inline-block rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground"
        >
          Voltar para Meus Cursos
        </Link>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold font-display md:text-3xl">Alunos & Controle de Matrículas</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Cadastre alunos, edite informações, vincule ou remova cursos e acompanhe o progresso de cada um.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className="text-xs">
            {profiles.length} alunos
          </Badge>

          <button
            onClick={() => {
              setStudentForm({
                full_name: "",
                email: "",
                whatsapp: "",
                initialCourseIds: [],
              });
              setEditingStudentId(null);
              setStudentModalOpen(true);
            }}
            className="glow-primary inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            <UserPlus className="size-3.5" /> Cadastrar Aluno
          </button>
        </div>
      </div>

      {/* Barra de Pesquisa */}
      <div className="panel p-3.5 flex items-center gap-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar aluno por nome, e-mail ou WhatsApp..."
          className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground"
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

      {/* Tabela de Alunos e Cursos */}
      <div className="panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">Aluno</th>
                <th className="p-4">Contato</th>
                <th className="p-4">Cursos com Acesso & Progresso</th>
                <th className="p-4 text-right">Ações</th>
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
                        <div className="text-muted-foreground text-xs mt-0.5">{student.email}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Cadastrado em: {new Date(student.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </td>

                      {/* WhatsApp / Contato */}
                      <td className="p-4 align-top text-muted-foreground">
                        {student.whatsapp || "Não informado"}
                      </td>

                      {/* Checkboxes de Acesso por Curso */}
                      <td className="p-4 align-top">
                        <div className="space-y-2">
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
                                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 transition-colors ${
                                  hasAccess
                                    ? "border-blue-500/40 bg-blue-500/5 text-foreground"
                                    : "border-border/60 bg-secondary/20 text-muted-foreground"
                                }`}
                              >
                                <label className="flex items-center gap-2 cursor-pointer select-none min-w-[200px]">
                                  <input
                                    type="checkbox"
                                    checked={hasAccess}
                                    onChange={() =>
                                      toggleCourseAccessMutation.mutate({
                                        studentId: student.id,
                                        courseId: course.id,
                                        hasAccess,
                                      })
                                    }
                                    className="size-4 rounded accent-primary cursor-pointer shrink-0"
                                  />
                                  <span
                                    className={`text-xs ${
                                      hasAccess ? "font-bold text-foreground" : "text-muted-foreground line-through opacity-70"
                                    }`}
                                  >
                                    {course.title}
                                  </span>
                                </label>

                                {hasAccess && (
                                  <div className="flex items-center gap-3 text-[11px]">
                                    {/* Progresso do aluno neste curso */}
                                    <div className="flex items-center gap-1.5 min-w-[90px]">
                                      <span className="font-bold text-primary">{pct}%</span>
                                      <ProgressBar value={pct} className="w-14 h-1.5" />
                                    </div>

                                    {/* Botão de Bloquear / Liberar */}
                                    <button
                                      onClick={() =>
                                        toggleBlockMutation.mutate({
                                          studentId: student.id,
                                          courseId: course.id,
                                          currentStatus: enrollment?.status || "active",
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

                      {/* Ações: Editar e Excluir */}
                      <td className="p-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingStudentId(student.id);
                              setStudentForm({
                                full_name: student.full_name || "",
                                email: student.email || "",
                                whatsapp: student.whatsapp || "",
                                initialCourseIds: [],
                              });
                              setStudentModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title="Editar Dados do Aluno"
                          >
                            <Edit className="size-3 text-primary" /> Editar
                          </button>

                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Tem certeza que deseja excluir o aluno "${student.full_name || student.email}"? Todas as matrículas serão removidas.`
                                )
                              ) {
                                deleteStudentMutation.mutate(student.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Remover Aluno"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CADASTRAR / EDITAR ALUNO */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in-50">
          <div className="panel w-full max-w-md p-6 space-y-4 bg-card border-primary/30 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-primary" />
                <h3 className="font-display text-lg font-bold">
                  {editingStudentId ? "Editar Dados do Aluno" : "Cadastrar Novo Aluno"}
                </h3>
              </div>
              <button
                onClick={() => setStudentModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveStudentMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="font-bold text-foreground block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={studentForm.full_name}
                  onChange={(e) => setStudentForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Nome do aluno"
                  className="w-full rounded-xl border border-border bg-secondary/50 p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">E-mail do Aluno *</label>
                <input
                  type="email"
                  required
                  value={studentForm.email}
                  onChange={(e) => setStudentForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="emaildoaluno@exemplo.com"
                  className="w-full rounded-xl border border-border bg-secondary/50 p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">WhatsApp / Telefone</label>
                <input
                  type="text"
                  value={studentForm.whatsapp}
                  onChange={(e) => setStudentForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="w-full rounded-xl border border-border bg-secondary/50 p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Matrícula Inicial nos Cursos (Apenas no Cadastro) */}
              {!editingStudentId && courses.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <label className="font-bold text-foreground block">
                    Matricular Inicialmente nos Cursos:
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-secondary/30 border border-border">
                    {courses.map((course) => {
                      const checked = studentForm.initialCourseIds.includes(course.id);
                      return (
                        <label
                          key={course.id}
                          className="flex items-center gap-2 cursor-pointer select-none text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setStudentForm((prev) => ({
                                ...prev,
                                initialCourseIds: checked
                                  ? prev.initialCourseIds.filter((id) => id !== course.id)
                                  : [...prev.initialCourseIds, course.id],
                              }));
                            }}
                            className="size-3.5 rounded accent-primary"
                          />
                          <span className={checked ? "font-bold text-primary" : "text-muted-foreground"}>
                            {course.title}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveStudentMutation.isPending}
                  className="glow-primary rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  {saveStudentMutation.isPending ? "Salvando..." : "Salvar Aluno"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAlunosPage;
