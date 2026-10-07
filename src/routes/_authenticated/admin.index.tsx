import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Edit,
  ExternalLink,
  FolderPlus,
  GraduationCap,
  Layers,
  ListChecks,
  Loader2,
  Lock,
  Plus,
  PlusCircle,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ProgressBar";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Painel do Administrador — Informática com Jhon" },
      { name: "description", content: "Administração central de cursos, alunos e matrículas na plataforma." },
    ],
  }),
  component: AdminCentralPage,
});

type AdminTab = "visao-geral" | "cursos" | "alunos" | "matriculas";

export function AdminCentralPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<AdminTab>("visao-geral");

  // Filtro de Curso para Visão Geral
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");

  // Estados de Gerenciamento de Cursos
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    cover_url: "",
    category: "Carreiras Policiais",
    position: 1,
    status: "published",
  });

  // Estados de Gerenciamento de Alunos
  const [studentSearch, setStudentSearch] = useState("");
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState({
    full_name: "",
    email: "",
    whatsapp: "",
    initialCourseIds: [] as string[],
  });

  // Modal de Matrículas Rápidas de um Aluno
  const [enrollStudentModalOpen, setEnrollStudentModalOpen] = useState(false);
  const [selectedStudentForEnroll, setSelectedStudentForEnroll] = useState<any | null>(null);

  // Consulta Principal dos Dados Administrativos
  const { data, isLoading } = useQuery({
    queryKey: ["admin_central_data"],
    enabled: isAdmin,
    queryFn: async () => {
      const [
        coursesRes,
        modulesRes,
        lessonsRes,
        profilesRes,
        studentCoursesRes,
        questionsRes,
        progressRes,
      ] = await Promise.all([
        supabase.from("courses").select("*").order("position"),
        supabase.from("modules").select("id, title, course_id, position").order("position"),
        supabase.from("lessons").select("id, title, module_id, position").order("position"),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("student_courses").select("*"),
        supabase.from("questions").select("id, course_id, module_id"),
        supabase.from("lesson_progress").select("user_id, lesson_id, course_id, completed"),
      ]);

      const courses = coursesRes.data ?? [];
      const modules = modulesRes.data ?? [];
      const lessons = lessonsRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const studentCourses = studentCoursesRes.data ?? [];
      const questions = questionsRes.data ?? [];
      const progress = progressRes.data ?? [];

      // Mapear estatísticas de cada curso
      const enrichedCourses = courses.map((course) => {
        const cModules = modules.filter((m) => m.course_id === course.id);
        const moduleIds = new Set(cModules.map((m) => m.id));
        const cLessons = lessons.filter((l) => moduleIds.has(l.module_id));
        const activeStudents = studentCourses.filter(
          (sc) => sc.course_id === course.id && sc.status === "active"
        ).length;

        return {
          ...course,
          modulesCount: cModules.length,
          lessonsCount: cLessons.length,
          studentsCount: activeStudents,
        };
      });

      // Mapear aulas por curso
      const lessonsPerCourse: Record<string, string[]> = {};
      courses.forEach((c) => {
        const cMods = modules.filter((m) => m.course_id === c.id).map((m) => m.id);
        lessonsPerCourse[c.id] = lessons.filter((l) => cMods.includes(l.module_id)).map((l) => l.id);
      });

      return {
        courses: enrichedCourses,
        allModules: modules,
        allLessons: lessons,
        profiles,
        studentCourses,
        questions,
        progress,
        lessonsPerCourse,
      };
    },
  });

  // Mutações de CURSOS
  const saveCourseMutation = useMutation({
    mutationFn: async () => {
      if (!courseForm.title.trim()) {
        throw new Error("O nome do curso é obrigatório.");
      }

      if (editingCourseId) {
        // Atualizar
        const { error } = await supabase
          .from("courses")
          .update({
            title: courseForm.title.trim(),
            description: courseForm.description.trim(),
            cover_url: courseForm.cover_url.trim() || "/images/capa-padrao.png",
            category: courseForm.category.trim(),
            position: courseForm.position,
            status: courseForm.status,
          })
          .eq("id", editingCourseId);
        if (error) throw error;
      } else {
        // Criar
        const { error } = await supabase.from("courses").insert({
          title: courseForm.title.trim(),
          description: courseForm.description.trim(),
          cover_url: courseForm.cover_url.trim() || "/images/capa-padrao.png",
          category: courseForm.category.trim(),
          position: courseForm.position,
          status: courseForm.status,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_central_data"] });
      queryClient.invalidateQueries({ queryKey: ["admin_courses_full"] });
      queryClient.invalidateQueries({ queryKey: ["meus-cursos"] });
      toast.success(editingCourseId ? "Curso atualizado com sucesso!" : "Novo curso criado com sucesso!");
      setCourseModalOpen(false);
      setEditingCourseId(null);
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar curso", { description: err.message });
    },
  });

  const toggleCourseStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from("courses").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_central_data"] });
      queryClient.invalidateQueries({ queryKey: ["meus-cursos"] });
      toast.success("Status do curso atualizado!");
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar status", { description: err.message });
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_central_data"] });
      queryClient.invalidateQueries({ queryKey: ["meus-cursos"] });
      toast.success("Curso removido com sucesso.");
    },
    onError: (err: any) => {
      toast.error("Erro ao remover curso", { description: err.message });
    },
  });

  // Mutações de ALUNOS
  const saveStudentMutation = useMutation({
    mutationFn: async () => {
      if (!studentForm.full_name.trim() || !studentForm.email.trim()) {
        throw new Error("Nome e E-mail são obrigatórios.");
      }

      if (editingStudentId) {
        // Atualizar dados do aluno existente
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
        // Cadastrar novo aluno
        const newStudentId = crypto.randomUUID();
        const { error: profileError } = await supabase.from("profiles").insert({
          id: newStudentId,
          full_name: studentForm.full_name.trim(),
          email: studentForm.email.trim().toLowerCase(),
          whatsapp: studentForm.whatsapp.trim(),
        });
        if (profileError) throw profileError;

        // Se selecionou cursos iniciais, matricular automaticamente
        if (studentForm.initialCourseIds.length > 0) {
          const enrollments = studentForm.initialCourseIds.map((courseId) => ({
            student_id: newStudentId,
            course_id: courseId,
            status: "active",
          }));
          const { error: enrollErr } = await supabase.from("student_courses").insert(enrollments);
          if (enrollErr) console.warn("Aviso na matrícula inicial:", enrollErr.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_central_data"] });
      queryClient.invalidateQueries({ queryKey: ["admin_students_and_courses"] });
      toast.success(editingStudentId ? "Dados do aluno atualizados!" : "Aluno cadastrado com sucesso!");
      setStudentModalOpen(false);
      setEditingStudentId(null);
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar aluno", { description: err.message });
    },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      // 1. Remover matrículas
      await supabase.from("student_courses").delete().eq("student_id", studentId);
      // 2. Remover progresso
      await supabase.from("lesson_progress").delete().eq("user_id", studentId);
      // 3. Remover perfil
      const { error } = await supabase.from("profiles").delete().eq("id", studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_central_data"] });
      queryClient.invalidateQueries({ queryKey: ["admin_students_and_courses"] });
      toast.success("Aluno removido da plataforma.");
    },
    onError: (err: any) => {
      toast.error("Erro ao remover aluno", { description: err.message });
    },
  });

  // Mutações de MATRÍCULAS (Associar / Desassociar Aluno a Cursos)
  const toggleCourseEnrollmentMutation = useMutation({
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
        // Desmatricular / Remover associação
        const { error } = await supabase
          .from("student_courses")
          .delete()
          .eq("student_id", studentId)
          .eq("course_id", courseId);
        if (error) throw error;
      } else {
        // Matricular / Associar aluno ao curso
        const { error } = await supabase.from("student_courses").insert({
          student_id: studentId,
          course_id: courseId,
          status: "active",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_central_data"] });
      queryClient.invalidateQueries({ queryKey: ["admin_students_and_courses"] });
      toast.success("Matrícula atualizada com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro na matrícula", { description: err.message });
    },
  });

  const toggleBlockStatusMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["admin_central_data"] });
      toast.success("Status de acesso alterado!");
    },
    onError: (err: any) => {
      toast.error("Erro ao alterar status", { description: err.message });
    },
  });

  // Verificação de Acesso: Apenas Administrador
  if (authLoading || isLoading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Carregando painel administrativo...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center space-y-4 max-w-md mx-auto my-12 border-rose-500/30">
        <div className="grid size-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-500 mx-auto">
          <Lock className="size-6" />
        </div>
        <h2 className="text-xl font-bold font-display text-foreground">Acesso Restrito ao Administrador</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Esta tela é restrita exclusivamente ao usuário administrador oficial (<strong>professorjonatasg@gmail.com</strong>).
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

  const courses = data?.courses ?? [];
  const profiles = data?.profiles ?? [];
  const studentCourses = data?.studentCourses ?? [];
  const progress = data?.progress ?? [];
  const lessonsPerCourse = data?.lessonsPerCourse ?? {};
  const allLessons = data?.allLessons ?? [];
  const allModules = data?.allModules ?? [];
  const questions = data?.questions ?? [];

  // Filtro de Alunos na busca
  const filteredProfiles = profiles.filter((p) => {
    const term = studentSearch.toLowerCase().trim();
    if (!term) return true;
    return (
      (p.full_name || "").toLowerCase().includes(term) ||
      (p.email || "").toLowerCase().includes(term) ||
      (p.whatsapp || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8 pb-16">
      {/* CABEÇALHO DO PAINEL DO ADMINISTRADOR */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-0.5 text-[11px] font-bold text-blue-400">
              <ShieldCheck className="size-3.5" /> Administrador Oficial
            </span>
            <span className="text-xs text-zinc-400 font-mono">professorjonatasg@gmail.com</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-foreground">
            Painel de Controle do Administrador
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Gerenciamento completo de cursos, alunos e matrículas da plataforma Informática com Jhon.
          </p>
        </div>

        {/* Ações Rápidas de Topo */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setCourseForm({
                title: "",
                description: "",
                cover_url: "",
                category: "Carreiras Policiais",
                position: courses.length + 1,
                status: "published",
              });
              setEditingCourseId(null);
              setCourseModalOpen(true);
            }}
            className="glow-primary inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            <PlusCircle className="size-3.5" /> NOVO CURSO
          </button>

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
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3.5 py-2 text-xs font-bold text-foreground hover:bg-secondary transition-colors"
          >
            <UserPlus className="size-3.5 text-blue-400" /> CADASTRAR ALUNO
          </button>
        </div>
      </header>

      {/* ABAS DE NAVEGAÇÃO DA ÁREA DO ADMINISTRADOR */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-3 overflow-x-auto">
        {[
          { id: "visao-geral", label: "Visão Geral", icon: Layers },
          { id: "cursos", label: `Cursos (${courses.length})`, icon: GraduationCap },
          { id: "alunos", label: `Alunos (${profiles.length})`, icon: Users },
          { id: "matriculas", label: "Matrículas Rápidas", icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold tracking-wide transition-all whitespace-nowrap ${
                isCurrent
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: VISÃO GERAL */}
      {/* ========================================================================= */}
      {activeTab === "visao-geral" && (
        <div className="space-y-8 animate-in fade-in-50">
          {/* CARDS DE RESUMO */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="panel p-5 space-y-1 border border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase">Total de Cursos</span>
                <GraduationCap className="size-4 text-primary" />
              </div>
              <p className="font-display text-3xl font-extrabold text-foreground">{courses.length}</p>
              <p className="text-[11px] text-muted-foreground">
                {courses.filter((c) => c.status === "published").length} publicados · {courses.filter((c) => c.status === "draft").length} rascunhos
              </p>
            </div>

            <div className="panel p-5 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase">Total de Alunos</span>
                <Users className="size-4 text-primary" />
              </div>
              <p className="font-display text-3xl font-extrabold text-foreground">{profiles.length}</p>
              <p className="text-[11px] text-muted-foreground">
                {studentCourses.filter((sc) => sc.status === "active").length} matrículas ativas
              </p>
            </div>

            <div className="panel p-5 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase">Aulas Cadastradas</span>
                <Video className="size-4 text-primary" />
              </div>
              <p className="font-display text-3xl font-extrabold text-foreground">{allLessons.length}</p>
              <p className="text-[11px] text-muted-foreground">
                Distribuídas em {allModules.length} módulos
              </p>
            </div>

            <div className="panel p-5 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase">Banco de Questões</span>
                <ListChecks className="size-4 text-primary" />
              </div>
              <p className="font-display text-3xl font-extrabold text-foreground">{questions.length}</p>
              <p className="text-[11px] text-muted-foreground">Comentadas e vinculadas aos cursos</p>
            </div>
          </div>

          {/* ATALHOS RÁPIDOS */}
          <div className="grid gap-4 sm:grid-cols-3">
            <button
              onClick={() => setActiveTab("cursos")}
              className="panel group text-left p-5 border hover:border-primary transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <GraduationCap className="size-5" />
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-display font-bold text-base">Gerenciamento de Cursos</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Adicione, edite capas verticais, configure categorias e gerencie o catálogo.
              </p>
            </button>

            <button
              onClick={() => setActiveTab("alunos")}
              className="panel group text-left p-5 border hover:border-primary transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Users className="size-5" />
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-display font-bold text-base">Gerenciamento de Alunos</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre novos alunos, altere dados cadastrais e controle o acesso.
              </p>
            </button>

            <button
              onClick={() => setActiveTab("matriculas")}
              className="panel group text-left p-5 border hover:border-primary transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <UserCheck className="size-5" />
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-display font-bold text-base">Controle de Matrículas</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Associe ou remova cursos de cada aluno com 1 clique diretamente pelo painel.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: GERENCIAR CURSOS */}
      {/* ========================================================================= */}
      {activeTab === "cursos" && (
        <div className="space-y-6 animate-in fade-in-50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold font-display">Cursos da Plataforma</h2>
              <p className="text-xs text-muted-foreground">
                Cadastre, edite informações, altere capas e remova cursos.
              </p>
            </div>

            <button
              onClick={() => {
                setCourseForm({
                  title: "",
                  description: "",
                  cover_url: "",
                  category: "Carreiras Policiais",
                  position: courses.length + 1,
                  status: "published",
                });
                setEditingCourseId(null);
                setCourseModalOpen(true);
              }}
              className="glow-primary inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground self-start sm:self-auto"
            >
              <PlusCircle className="size-3.5" /> Adicionar Novo Curso
            </button>
          </div>

          {courses.length === 0 ? (
            <div className="panel p-12 text-center text-muted-foreground">
              <GraduationCap className="size-12 mx-auto mb-3 opacity-40" />
              <p className="text-base font-bold text-foreground">Nenhum curso cadastrado ainda</p>
              <p className="text-xs mt-1">Clique no botão acima para criar o primeiro curso.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="panel flex flex-col justify-between overflow-hidden border border-zinc-800 bg-[#0c0e12] transition-all hover:border-primary/50"
                >
                  <div>
                    {/* Capa */}
                    <div className="relative aspect-video w-full bg-secondary overflow-hidden">
                      <img
                        src={course.cover_url || "/images/capa-padrao.png"}
                        alt={course.title}
                        className="size-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/images/capa-padrao.png";
                        }}
                      />
                      <span className="absolute top-2.5 left-2.5 rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase backdrop-blur-sm">
                        {course.category}
                      </span>
                      <Badge
                        variant={course.status === "published" ? "default" : "secondary"}
                        className="absolute top-2.5 right-2.5 text-[10px] uppercase font-bold"
                      >
                        {course.status === "published" ? "Publicado" : "Rascunho"}
                      </Badge>
                    </div>

                    <div className="p-4 space-y-3">
                      <h3 className="font-display text-base font-bold text-foreground truncate">
                        {course.title}
                      </h3>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {course.description || "Curso preparatório de informática para concursos."}
                      </p>

                      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/50 bg-secondary/30 p-2 text-center text-xs">
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

                      <Link
                        to="/admin/aulas/nova"
                        search={{ cursoId: course.id } as any}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-600/10 py-1.5 text-xs font-bold text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                      >
                        <PlusCircle className="size-3.5" /> Inserir Videoaula neste Curso
                      </Link>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-secondary/20 p-3 text-xs">
                    <button
                      onClick={() =>
                        toggleCourseStatusMutation.mutate({
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

                    <div className="flex items-center gap-1.5">
                      <Link
                        to="/curso"
                        search={{ cursoId: course.id }}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-secondary transition-colors"
                      >
                        Ver <ExternalLink className="size-3" />
                      </Link>

                      <button
                        onClick={() => {
                          setEditingCourseId(course.id);
                          setCourseForm({
                            title: course.title,
                            description: course.description || "",
                            cover_url: course.cover_url || "",
                            category: course.category || "Carreiras Policiais",
                            position: course.position || 1,
                            status: course.status || "published",
                          });
                          setCourseModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Editar Curso"
                      >
                        <Edit className="size-3 text-primary" /> Editar
                      </button>

                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Tem certeza que deseja excluir o curso "${course.title}"? Todos os módulos e aulas associados serão removidos.`
                            )
                          ) {
                            deleteCourseMutation.mutate(course.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Remover Curso"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: GERENCIAR ALUNOS */}
      {/* ========================================================================= */}
      {activeTab === "alunos" && (
        <div className="space-y-6 animate-in fade-in-50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold font-display">Alunos Cadastrados</h2>
              <p className="text-xs text-muted-foreground">
                Cadastre alunos, edite informações, gerencie cursos associados ou remova acessos.
              </p>
            </div>

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
              className="glow-primary inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground self-start sm:self-auto"
            >
              <UserPlus className="size-3.5" /> Cadastrar Novo Aluno
            </button>
          </div>

          {/* Busca Rápida de Alunos */}
          <div className="panel p-3.5 flex items-center gap-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Buscar aluno por nome, e-mail ou WhatsApp..."
              className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground"
            />
            {studentSearch && (
              <button
                onClick={() => setStudentSearch("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Tabela de Alunos */}
          <div className="panel overflow-hidden border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-secondary/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-4">Aluno</th>
                    <th className="p-4">Contato</th>
                    <th className="p-4">Cursos Matriculados</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        Nenhum aluno encontrado com este critério de busca.
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map((student) => {
                      const studentEnrollments = studentCourses.filter(
                        (sc) => sc.student_id === student.id
                      );

                      const enrolledCourses = courses.filter((c) =>
                        studentEnrollments.some((sc) => sc.course_id === c.id)
                      );

                      return (
                        <tr key={student.id} className="hover:bg-secondary/20 transition-colors">
                          {/* Nome e E-mail */}
                          <td className="p-4 align-top">
                            <div className="font-bold text-foreground text-sm">
                              {student.full_name || "Sem Nome"}
                            </div>
                            <div className="text-muted-foreground text-xs mt-0.5">{student.email}</div>
                          </td>

                          {/* WhatsApp */}
                          <td className="p-4 align-top text-muted-foreground">
                            {student.whatsapp || "Não informado"}
                          </td>

                          {/* Cursos Matriculados (Badges) */}
                          <td className="p-4 align-top">
                            {enrolledCourses.length === 0 ? (
                              <span className="text-muted-foreground text-[11px] italic">
                                Nenhum curso vinculado
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {enrolledCourses.map((c) => {
                                  const enr = studentEnrollments.find((sc) => sc.course_id === c.id);
                                  const isBlocked = enr?.status === "blocked";
                                  return (
                                    <span
                                      key={c.id}
                                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                                        isBlocked
                                          ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                                          : "border-blue-500/30 bg-blue-500/10 text-blue-400"
                                      }`}
                                    >
                                      {c.title}
                                      {isBlocked && " (Bloqueado)"}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          {/* Ações: Gerenciar Matrículas, Editar, Remover */}
                          <td className="p-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedStudentForEnroll(student);
                                  setEnrollStudentModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-secondary transition-colors"
                                title="Gerenciar Matrículas deste Aluno"
                              >
                                <UserCheck className="size-3" /> Matrículas
                              </button>

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
                                      `Tem certeza que deseja remover o aluno "${student.full_name || student.email}" da plataforma?`
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: MATRÍCULAS RÁPIDAS (Controle por Aluno e Curso) */}
      {/* ========================================================================= */}
      {activeTab === "matriculas" && (
        <div className="space-y-6 animate-in fade-in-50">
          <div>
            <h2 className="text-xl font-bold font-display">Matrículas & Acessos Diretos</h2>
            <p className="text-xs text-muted-foreground">
              Associe ou remova alunos de cursos individualmente com 1 clique diretamente pelo painel.
            </p>
          </div>

          <div className="panel p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Filtrar aluno para gerenciar matrículas..."
                className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-4">
              {filteredProfiles.map((student) => {
                const studentEnrollments = studentCourses.filter(
                  (sc) => sc.student_id === student.id
                );

                return (
                  <div
                    key={student.id}
                    className="panel p-4 border border-border/70 bg-zinc-900/30 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                      <div>
                        <span className="font-bold text-sm text-foreground">
                          {student.full_name || "Sem Nome"}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">({student.email})</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {studentEnrollments.length} {studentEnrollments.length === 1 ? "curso ativo" : "cursos ativos"}
                      </span>
                    </div>

                    {/* Checkboxes de Matrícula Direta */}
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {courses.map((course) => {
                        const enrollment = studentEnrollments.find(
                          (sc) => sc.course_id === course.id
                        );
                        const hasAccess = Boolean(enrollment);
                        const isBlocked = enrollment?.status === "blocked";

                        return (
                          <div
                            key={course.id}
                            className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition-colors ${
                              hasAccess
                                ? "border-blue-500/40 bg-blue-500/5 text-foreground"
                                : "border-border/60 bg-secondary/20 text-muted-foreground"
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
                              <input
                                type="checkbox"
                                checked={hasAccess}
                                onChange={() =>
                                  toggleCourseEnrollmentMutation.mutate({
                                    studentId: student.id,
                                    courseId: course.id,
                                    hasAccess,
                                  })
                                }
                                className="size-4 rounded accent-primary cursor-pointer shrink-0"
                              />
                              <span className="truncate font-semibold">{course.title}</span>
                            </label>

                            {hasAccess && (
                              <button
                                onClick={() =>
                                  toggleBlockStatusMutation.mutate({
                                    studentId: student.id,
                                    courseId: course.id,
                                    currentStatus: enrollment?.status || "active",
                                  })
                                }
                                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors shrink-0 ${
                                  isBlocked
                                    ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                                    : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                }`}
                                title={isBlocked ? "Liberar acesso" : "Bloquear acesso"}
                              >
                                {isBlocked ? "Bloqueado" : "Ativo"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CADASTRAR / EDITAR CURSO */}
      {/* ========================================================================= */}
      {courseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in-50">
          <div className="panel w-full max-w-lg p-6 space-y-4 bg-card border-primary/30 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-5 text-primary" />
                <h3 className="font-display text-lg font-bold">
                  {editingCourseId ? "Editar Curso" : "Novo Curso"}
                </h3>
              </div>
              <button
                onClick={() => setCourseModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveCourseMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="font-bold text-foreground block mb-1">Nome do Curso *</label>
                <input
                  type="text"
                  required
                  value={courseForm.title}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: INFORMÁTICA PARA PMBA, POLÍCIA CIVIL..."
                  className="w-full rounded-xl border border-border bg-secondary/50 p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={courseForm.description}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Objetivos, foco do edital e bancas abordadas..."
                  className="w-full rounded-xl border border-border bg-secondary/50 p-2.5 text-xs text-foreground focus:border-primary focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Categoria / Concurso</label>
                  <input
                    type="text"
                    value={courseForm.category}
                    onChange={(e) => setCourseForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-secondary/50 p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Posição na Listagem</label>
                  <input
                    type="number"
                    min={1}
                    value={courseForm.position}
                    onChange={(e) => setCourseForm((prev) => ({ ...prev, position: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-border bg-secondary/50 p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">URL da Imagem da Capa</label>
                <input
                  type="text"
                  value={courseForm.cover_url}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, cover_url: e.target.value }))}
                  placeholder="/images/capa-padrao.png ou link da imagem"
                  className="w-full rounded-xl border border-border bg-secondary/50 p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Status de Publicação</label>
                <select
                  value={courseForm.status}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-secondary/50 p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="published">Publicado (Visível aos Alunos)</option>
                  <option value="draft">Rascunho (Apenas Administrador)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCourseModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveCourseMutation.isPending}
                  className="glow-primary rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  {saveCourseMutation.isPending ? "Salvando..." : "Salvar Curso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CADASTRAR / EDITAR ALUNO */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* MODAL: GERENCIAR MATRÍCULAS DO ALUNO SELECIONADO */}
      {/* ========================================================================= */}
      {enrollStudentModalOpen && selectedStudentForEnroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in-50">
          <div className="panel w-full max-w-lg p-6 space-y-4 bg-card border-primary/30 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  Matrículas de {selectedStudentForEnroll.full_name || selectedStudentForEnroll.email}
                </h3>
                <p className="text-xs text-muted-foreground">{selectedStudentForEnroll.email}</p>
              </div>
              <button
                onClick={() => setEnrollStudentModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Selecione quais cursos este aluno possui acesso. Marque para matricular ou desmarque para remover.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto p-1">
              {courses.map((course) => {
                const enrollment = studentCourses.find(
                  (sc) => sc.student_id === selectedStudentForEnroll.id && sc.course_id === course.id
                );
                const hasAccess = Boolean(enrollment);
                const isBlocked = enrollment?.status === "blocked";

                return (
                  <div
                    key={course.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs transition-colors ${
                      hasAccess
                        ? "border-blue-500/40 bg-blue-500/10 text-foreground"
                        : "border-border bg-secondary/20 text-muted-foreground"
                    }`}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasAccess}
                        onChange={() =>
                          toggleCourseEnrollmentMutation.mutate({
                            studentId: selectedStudentForEnroll.id,
                            courseId: course.id,
                            hasAccess,
                          })
                        }
                        className="size-4 rounded accent-primary cursor-pointer"
                      />
                      <span className="font-semibold text-sm">{course.title}</span>
                    </label>

                    {hasAccess && (
                      <button
                        onClick={() =>
                          toggleBlockStatusMutation.mutate({
                            studentId: selectedStudentForEnroll.id,
                            courseId: course.id,
                            currentStatus: enrollment?.status || "active",
                          })
                        }
                        className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${
                          isBlocked
                            ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                        }`}
                      >
                        {isBlocked ? "Bloqueado" : "Ativo"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-border">
              <button
                onClick={() => setEnrollStudentModalOpen(false)}
                className="glow-primary rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCentralPage;
