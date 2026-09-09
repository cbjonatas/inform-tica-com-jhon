import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  Filter,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { QuestionCard } from "@/components/QuestionCard";

export const Route = createFileRoute("/_authenticated/questoes")({
  head: () => ({
    meta: [
      { title: "Banco de Questões — Informática com Jhon" },
      { name: "description", content: "Resolva questões de informática comentadas e revise suas questões erradas." },
    ],
  }),
  component: QuestoesPage,
});

type ViewMode = "todas" | "erradas" | "favoritas";

function QuestoesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>("todas");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedBanca, setSelectedBanca] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["questoes_full_page", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [modulesRes, questionsRes, attemptsRes, favsRes] = await Promise.all([
        supabase.from("modules").select("id, title").order("position"),
        supabase.from("questions").select("*, modules(title)").order("created_at", { ascending: false }),
        supabase
          .from("question_attempts")
          .select("question_id, selected_index, is_correct, created_at")
          .eq("user_id", user?.id || "")
          .order("created_at", { ascending: false }),
        supabase.from("favorites").select("item_id").eq("item_type", "question").eq("user_id", user?.id || ""),
      ]);

      const favSet = new Set((favsRes.data ?? []).map((f) => f.item_id));
      setFavoritedIds(favSet);

      return {
        modules: modulesRes.data ?? [],
        questions: questionsRes.data ?? [],
        attempts: attemptsRes.data ?? [],
      };
    },
  });

  const recordAttemptMutation = useMutation({
    mutationFn: async ({ qId, optIndex, isCorrect }: { qId: string; optIndex: number; isCorrect: boolean }) => {
      if (!user?.id) return;
      await supabase.from("question_attempts").insert({
        user_id: user.id,
        question_id: qId,
        selected_index: optIndex,
        is_correct: isCorrect,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questoes_full_page"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const toggleFavorite = async (q: any) => {
    if (!user?.id) return;
    const isFav = favoritedIds.has(q.id);

    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("item_type", "question").eq("item_id", q.id);
      setFavoritedIds((prev) => {
        const next = new Set(prev);
        next.delete(q.id);
        return next;
      });
    } else {
      await supabase.from("favorites").insert({
        user_id: user.id,
        item_type: "question",
        item_id: q.id,
        title: q.statement.slice(0, 70) + "...",
        subtitle: `${q.banca || "Banca"} ${q.ano || ""}`,
      });
      setFavoritedIds((prev) => {
        const next = new Set(prev);
        next.add(q.id);
        return next;
      });
    }
  };

  const modules = data?.modules ?? [];
  const allQuestions = data?.questions ?? [];
  const attempts = data?.attempts ?? [];

  const latestAttemptMap = new Map<string, { selected_index: number; is_correct: boolean }>();
  attempts.forEach((a) => {
    if (a.question_id && !latestAttemptMap.has(a.question_id)) {
      latestAttemptMap.set(a.question_id, { selected_index: a.selected_index, is_correct: a.is_correct });
    }
  });

  const wrongQuestionIds = new Set(
    Array.from(latestAttemptMap.entries())
      .filter(([_, att]) => !att.is_correct)
      .map(([id]) => id)
  );

  const bancas = Array.from(new Set(allQuestions.map((q) => q.banca).filter(Boolean)));

  const filteredQuestions = allQuestions.filter((q) => {
    if (viewMode === "erradas" && !wrongQuestionIds.has(q.id)) return false;
    if (viewMode === "favoritas" && !favoritedIds.has(q.id)) return false;
    if (selectedModule !== "all" && q.module_id !== selectedModule) return false;
    if (selectedBanca !== "all" && q.banca !== selectedBanca) return false;
    if (selectedDifficulty !== "all" && (q.difficulty || "medio") !== selectedDifficulty) return false;
    return true;
  });

  const totalRespondidas = attempts.length;
  const totalAcertos = attempts.filter((a) => a.is_correct).length;
  const taxaAcerto = totalRespondidas ? Math.round((totalAcertos / totalRespondidas) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando banco de questões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">TREINAMENTO INTENSIVO</p>
          <h1 className="mt-1 text-3xl font-bold font-display md:text-4xl">Banco de Questões Comentadas</h1>
          <p className="mt-1 text-muted-foreground">
            Resolva questões de provas reais e revise seus pontos fracos.
          </p>
        </div>

        <Link
          to="/questoes/ia"
          className="glow-primary inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground self-start sm:self-auto transition-transform hover:scale-[1.02]"
        >
          <Sparkles className="size-4" /> Gerador de Questões IA
        </Link>
      </div>

      {/* Cards de Métricas */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="panel p-4">
          <p className="font-display text-2xl font-bold">{allQuestions.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Questões disponíveis</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-2xl font-bold">{totalRespondidas}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tentativas registradas</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-2xl font-bold text-emerald-500">{totalAcertos}</p>
          <p className="mt-1 text-xs text-muted-foreground">Acertos totais</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-2xl font-bold text-red-500">{wrongQuestionIds.size}</p>
          <p className="mt-1 text-xs text-muted-foreground">Questões a refazer</p>
        </div>
      </section>

      {/* Seletor de Modo */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {[
          { id: "todas", label: "Todas as Questões", count: allQuestions.length },
          { id: "erradas", label: "MINHAS QUESTÕES ERRADAS", count: wrongQuestionIds.size, icon: AlertTriangle },
          { id: "favoritas", label: "Favoritas", count: favoritedIds.size, icon: Star },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id as ViewMode)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all border",
              viewMode === tab.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {tab.icon && <tab.icon className="size-3.5" />}
            <span>{tab.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px]",
                viewMode === tab.id ? "bg-white/20 text-white" : "bg-secondary/80 text-muted-foreground"
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Filter className="size-4 text-accent" />
          <span>Filtros:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
          >
            <option value="all">Todos os Módulos</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>

          <select
            value={selectedBanca}
            onChange={(e) => setSelectedBanca(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
          >
            <option value="all">Todas as Bancas</option>
            {bancas.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
          >
            <option value="all">Todas as Dificuldades</option>
            <option value="facil">Fácil</option>
            <option value="medio">Médio</option>
            <option value="dificil">Difícil</option>
          </select>

          {(selectedModule !== "all" || selectedBanca !== "all" || selectedDifficulty !== "all") && (
            <button
              onClick={() => {
                setSelectedModule("all");
                setSelectedBanca("all");
                setSelectedDifficulty("all");
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <RotateCcw className="size-3" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Lista de Questões renderizadas com QuestionCard */}
      <section className="space-y-6">
        {filteredQuestions.map((q, qIndex) => {
          const savedAttempt = latestAttemptMap.get(q.id);
          const currentSelectedIndex = selectedAnswers[q.id] ?? savedAttempt?.selected_index;

          return (
            <QuestionCard
              key={q.id}
              question={q}
              questionNumber={qIndex + 1}
              userSelectedIndex={currentSelectedIndex}
              isFavorited={favoritedIds.has(q.id)}
              onToggleFavorite={() => toggleFavorite(q)}
              onAnswer={(optIdx, isCorrect) => {
                setSelectedAnswers((prev) => ({ ...prev, [q.id]: optIdx }));
                recordAttemptMutation.mutate({ qId: q.id, optIndex: optIdx, isCorrect });
              }}
              onRetry={() => {
                setSelectedAnswers((prev) => {
                  const next = { ...prev };
                  delete next[q.id];
                  return next;
                });
              }}
            />
          );
        })}

        {filteredQuestions.length === 0 && (
          <div className="panel p-12 text-center text-muted-foreground space-y-3">
            <HelpCircle className="size-10 mx-auto text-muted-foreground/50" />
            <p className="text-base font-semibold">Nenhuma questão encontrada com os filtros atuais.</p>
            {viewMode === "erradas" && (
              <p className="text-xs text-emerald-500 font-medium">
                Parabéns! Você não possui nenhuma questão errada pendente de revisão.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
