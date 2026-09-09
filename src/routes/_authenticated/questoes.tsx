import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Filter, HelpCircle, ListChecks, RotateCcw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/questoes")({
  head: () => ({
    meta: [
      { title: "Banco de Questões — Informática com Jhon" },
      { name: "description", content: "Resolva questões de informática comentadas das principais bancas de concursos." },
    ],
  }),
  component: QuestoesPage,
});

function QuestoesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedBanca, setSelectedBanca] = useState<string>("all");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["questoes_page", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [modulesRes, questionsRes, attemptsRes] = await Promise.all([
        supabase.from("modules").select("id, title").order("position"),
        supabase.from("questions").select("*, modules(title)").order("created_at", { ascending: false }),
        supabase.from("question_attempts").select("question_id, selected_index, is_correct, created_at").eq("user_id", user?.id || ""),
      ]);

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
      queryClient.invalidateQueries({ queryKey: ["questoes_page"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const modules = data?.modules ?? [];
  const allQuestions = data?.questions ?? [];
  const attempts = data?.attempts ?? [];

  // Criar mapa das últimas tentativas
  const attemptsMap = new Map<string, { selected_index: number; is_correct: boolean }>();
  attempts.forEach((a) => {
    attemptsMap.set(a.question_id, { selected_index: a.selected_index, is_correct: a.is_correct });
  });

  // Bancas únicas disponíveis
  const bancas = Array.from(new Set(allQuestions.map((q) => q.banca).filter(Boolean)));

  // Filtragem
  const filteredQuestions = allQuestions.filter((q) => {
    if (selectedModule !== "all" && q.module_id !== selectedModule) return false;
    if (selectedBanca !== "all" && q.banca !== selectedBanca) return false;
    return true;
  });

  // Estatísticas do aluno
  const totalRespondidas = attempts.length;
  const totalAcertos = attempts.filter((a) => a.is_correct).length;
  const taxaAcerto = totalRespondidas ? Math.round((totalAcertos / totalRespondidas) * 100) : 0;

  const handleSelectOption = (qId: string, optIndex: number, correctIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optIndex }));
    const isCorrect = optIndex === correctIndex;
    recordAttemptMutation.mutate({ qId, optIndex, isCorrect });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando questões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <header>
        <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">TREINAMENTO INTENSIVO</p>
        <h1 className="mt-1 text-3xl font-bold font-display md:text-4xl">Banco de Questões Comentadas</h1>
        <p className="mt-1 text-muted-foreground">
          Pratique com questões reais das principais bancas de concursos (FGV, Cebraspe, FCC).
        </p>
      </header>

      {/* Cards de Métricas */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="panel p-4">
          <p className="font-display text-2xl font-bold">{allQuestions.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Questões disponíveis</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-2xl font-bold">{totalRespondidas}</p>
          <p className="mt-1 text-xs text-muted-foreground">Respondidas por você</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-2xl font-bold text-emerald-500">{totalAcertos}</p>
          <p className="mt-1 text-xs text-muted-foreground">Acertos totais</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-2xl font-bold text-primary">{taxaAcerto}%</p>
          <p className="mt-1 text-xs text-muted-foreground">Taxa de rendimento</p>
        </div>
      </section>

      {/* Barra de Filtros */}
      <div className="panel p-4 md:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="size-4 text-accent" />
          <span>Filtrar por:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro de Módulo */}
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

          {/* Filtro de Banca */}
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

          {(selectedModule !== "all" || selectedBanca !== "all") && (
            <button
              onClick={() => {
                setSelectedModule("all");
                setSelectedBanca("all");
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <RotateCcw className="size-3" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Listagem de Questões */}
      <section className="space-y-6">
        {filteredQuestions.map((q, qIndex) => {
          const options = Array.isArray(q.options) ? (q.options as string[]) : [];
          const savedAttempt = attemptsMap.get(q.id);
          const currentSelectedIndex = selectedAnswers[q.id] ?? savedAttempt?.selected_index;
          const hasAnswered = currentSelectedIndex !== undefined;
          const isCorrect = currentSelectedIndex === q.correct_index;

          return (
            <div key={q.id} className="panel p-6 space-y-4">
              {/* Header da questão */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-border/50 pb-3">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="text-primary font-bold">QUESTÃO #{qIndex + 1}</span>
                  {q.banca && (
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-foreground font-mono">
                      {q.banca}
                    </span>
                  )}
                  {q.ano && <span className="text-muted-foreground">{q.ano}</span>}
                </div>
                {q.modules?.title && (
                  <span className="text-xs text-muted-foreground truncate max-w-xs">{q.modules.title}</span>
                )}
              </div>

              {/* Enunciado */}
              <p className="text-base text-foreground leading-relaxed">{q.statement}</p>

              {/* Alternativas */}
              <div className="space-y-2.5 pt-2">
                {options.map((opt, optIndex) => {
                  const isSelected = currentSelectedIndex === optIndex;
                  const isThisCorrect = optIndex === q.correct_index;

                  let styleClass = "border-border bg-secondary/20 hover:bg-secondary/60";
                  if (hasAnswered) {
                    if (isThisCorrect) {
                      styleClass = "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 font-semibold";
                    } else if (isSelected) {
                      styleClass = "border-red-500/50 bg-red-500/10 text-red-500 line-through";
                    } else {
                      styleClass = "opacity-50 border-border";
                    }
                  }

                  return (
                    <button
                      key={optIndex}
                      disabled={hasAnswered}
                      onClick={() => handleSelectOption(q.id, optIndex, q.correct_index)}
                      className={cn(
                        "flex w-full items-start gap-3.5 rounded-xl border p-3.5 text-left text-sm transition-all",
                        styleClass
                      )}
                    >
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary font-mono text-xs font-bold">
                        {String.fromCharCode(65 + optIndex)}
                      </span>
                      <span className="flex-1 leading-relaxed">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Feedback e Comentário */}
              {hasAnswered && (
                <div
                  className={cn(
                    "rounded-xl p-4 text-sm leading-relaxed border space-y-2 mt-4",
                    isCorrect
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-amber-500/30 bg-amber-500/5"
                  )}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {isCorrect ? (
                      <span className="text-emerald-500 flex items-center gap-1.5">
                        <CheckCircle2 className="size-4" /> Resposta correta!
                      </span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1.5">
                        <XCircle className="size-4" /> Resposta incorreta. Gabarito oficial: Letra{" "}
                        {String.fromCharCode(65 + q.correct_index)}
                      </span>
                    )}
                  </div>
                  {q.explanation && (
                    <p className="text-xs md:text-sm text-muted-foreground">
                      <strong>Comentário do Professor Jhon:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredQuestions.length === 0 && (
          <div className="panel p-12 text-center text-muted-foreground space-y-3">
            <HelpCircle className="size-10 mx-auto text-muted-foreground/50" />
            <p className="text-base font-semibold">Nenhuma questão encontrada com os filtros selecionados.</p>
            <p className="text-xs">Tente selecionar outro módulo ou banca examinadora.</p>
          </div>
        )}
      </section>
    </div>
  );
}
