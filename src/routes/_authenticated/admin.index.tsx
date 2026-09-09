import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Painel do Professor — Informática com Jhon" },
      { name: "description", content: "Administração do curso e gestão completa de conteúdo e estatísticas." },
    ],
  }),
  component: AdminIndexPage,
});

function AdminIndexPage() {
  const { isAdmin, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["admin_full_dashboard"],
    enabled: isAdmin,
    queryFn: async () => {
      const [
        modulesRes,
        lessonsRes,
        profilesRes,
        questionsRes,
        attemptsRes,
        progressRes,
      ] = await Promise.all([
        supabase.from("modules").select("id, title, position").order("position"),
        supabase.from("lessons").select("id, title, module_id, position").order("position"),
        supabase.from("profiles").select("id, created_at"),
        supabase.from("questions").select("id, statement, banca"),
        supabase.from("question_attempts").select("question_id, is_correct, user_id"),
        supabase.from("lesson_progress").select("lesson_id, user_id, completed"),
      ]);

      const attempts = attemptsRes.data ?? [];
      const totalRespondidas = attempts.length;
      const acertos = attempts.filter((a) => a.is_correct).length;
      const taxaAcerto = totalRespondidas ? Math.round((acertos / totalRespondidas) * 100) : 0;

      // Alunos ativos (que resolveram questões ou assistiram aulas recentemente)
      const activeUserIds = new Set([
        ...attempts.map((a) => a.user_id),
        ...(progressRes.data ?? []).map((p) => p.user_id),
      ]);

      // Contagem de erros por questão
      const errorCountMap: Record<string, number> = {};
      attempts
        .filter((a) => !a.is_correct && a.question_id)
        .forEach((a) => {
          if (a.question_id) {
            errorCountMap[a.question_id] = (errorCountMap[a.question_id] || 0) + 1;
          }
        });

      // Aulas mais assistidas
      const lessonViewsMap: Record<string, number> = {};
      (progressRes.data ?? []).forEach((p) => {
        lessonViewsMap[p.lesson_id] = (lessonViewsMap[p.lesson_id] || 0) + 1;
      });

      return {
        modules: modulesRes.data ?? [],
        lessons: lessonsRes.data ?? [],
        totalAlunos: (profilesRes.data ?? []).length,
        alunosAtivos: activeUserIds.size,
        totalQuestoes: (questionsRes.data ?? []).length,
        questions: questionsRes.data ?? [],
        totalRespondidas,
        mediaAcertos: taxaAcerto,
        errorCountMap,
        lessonViewsMap,
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

  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center space-y-4 max-w-md mx-auto my-12">
        <div className="grid size-12 place-items-center rounded-full bg-red-500/10 text-red-500 mx-auto">
          <Settings className="size-6" />
        </div>
        <h2 className="text-xl font-bold font-display">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground">
          Esta área é restrita para o professor e administradores da plataforma.
        </p>
        <Link to="/dashboard" className="inline-block rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground">
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  const modules = data?.modules ?? [];
  const lessons = data?.lessons ?? [];
  const questions = data?.questions ?? [];
  const errorMap = data?.errorCountMap ?? {};
  const viewsMap = data?.lessonViewsMap ?? {};

  // Ordenar questões mais erradas
  const maisErradas = Object.entries(errorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([qId, errCount]) => ({
      question: questions.find((q) => q.id === qId),
      count: errCount,
    }))
    .filter((item) => item.question);

  // Ordenar aulas mais assistidas
  const maisAssistidas = Object.entries(viewsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([lId, vCount]) => ({
      lesson: lessons.find((l) => l.id === lId),
      count: vCount,
    }))
    .filter((item) => item.lesson);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">PAINEL DO PROFESSOR</p>
          <h1 className="mt-1 text-3xl font-bold font-display md:text-4xl">Visão Geral Administrativa</h1>
          <p className="mt-1 text-muted-foreground">
            Acompanhe engajamento dos alunos, rendimento nas questões e gerencie conteúdos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/aulas"
            className="rounded-xl border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors"
          >
            Gerenciar Aulas
          </Link>
          <Link
            to="/admin/modulos"
            className="rounded-xl border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors"
          >
            Módulos
          </Link>
          <Link
            to="/admin/aulas/nova"
            className="glow-primary inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            <PlusCircle className="size-3.5" /> Publicar Aula
          </Link>
        </div>
      </header>

      {/* Menu Rápido de Gestão (Item 21) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Módulos", to: "/admin/modulos", icon: Layers },
          { label: "Aulas", to: "/admin/aulas", icon: Video },
          { label: "Nova Aula", to: "/admin/aulas/nova", icon: PlusCircle },
          { label: "Materiais", to: "/materiais", icon: FileText },
          { label: "Questões IA", to: "/questoes/ia", icon: Sparkles },
          { label: "Simulados", to: "/questoes", icon: ListChecks },
        ].map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="panel flex items-center gap-2.5 p-3 text-xs font-semibold hover:border-primary hover:bg-secondary/40 transition-all"
          >
            <item.icon className="size-4 text-primary" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* 9 KPIs Obrigatórios (Item 21) */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="panel p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Total de Alunos</span>
            <Users className="size-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{data?.totalAlunos ?? 0}</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Alunos Ativos</span>
            <UserCheck className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-emerald-500">{data?.alunosAtivos ?? 0}</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Total de Aulas</span>
            <Video className="size-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{lessons.length}</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Total de Módulos</span>
            <Layers className="size-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{modules.length}</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Total de Questões</span>
            <HelpCircle className="size-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{data?.totalQuestoes ?? 0}</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Questões Respondidas</span>
            <ListChecks className="size-4 text-accent" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{data?.totalRespondidas ?? 0}</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Média Geral de Acertos</span>
            <TrendingUp className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-emerald-500">{data?.mediaAcertos ?? 0}%</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Rendimento da Turma</span>
            <BarChart3 className="size-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">
            {(data?.mediaAcertos ?? 0) >= 70 ? "Excelente" : "Em evolução"}
          </p>
        </div>
      </section>

      {/* Relatórios: Aulas Mais Assistidas & Questões Mais Erradas */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Aulas Mais Assistidas */}
        <section className="panel p-6 space-y-4">
          <h2 className="text-base font-bold font-display flex items-center gap-2">
            <Video className="size-4 text-primary" /> Aulas Mais Assistidas
          </h2>

          <div className="space-y-2.5">
            {maisAssistidas.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/20"
              >
                <div className="min-w-0 pr-3">
                  <p className="text-xs font-semibold truncate">{item.lesson?.title}</p>
                  <p className="text-[10px] text-muted-foreground">Posição #{item.lesson?.position}</p>
                </div>
                <span className="shrink-0 text-xs font-bold text-primary">
                  {item.count} acessos
                </span>
              </div>
            ))}

            {maisAssistidas.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Ainda não há dados suficientes de visualizações.
              </p>
            )}
          </div>
        </section>

        {/* Questões Mais Erradas */}
        <section className="panel p-6 space-y-4">
          <h2 className="text-base font-bold font-display flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" /> Questões com Maior Índice de Erro
          </h2>

          <div className="space-y-2.5">
            {maisErradas.map((item, i) => (
              <div
                key={i}
                className="p-3 rounded-xl border border-border bg-secondary/20 space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground truncate max-w-xs">
                    {item.question?.banca || "Concurso"}
                  </span>
                  <span className="text-xs font-bold text-red-500">{item.count} erros</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.question?.statement}
                </p>
              </div>
            ))}

            {maisErradas.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nenhum padrão crítico de erro registrado até o momento.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
