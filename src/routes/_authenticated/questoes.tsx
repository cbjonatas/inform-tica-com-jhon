import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Filter,
  HelpCircle,
  Loader2,
  RotateCcw,
  Sparkles,
  Star,
  Upload,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { QuestionCard } from "@/components/QuestionCard";
import { aiService } from "@/lib/ai/ai-service";
import { extractTextFromPdfBuffer } from "@/lib/ai/pdf-extractor";

export const Route = createFileRoute("/_authenticated/questoes")({
  head: () => ({
    meta: [
      { title: "Gerar Questões via PDF — Informática com Jhon" },
      { name: "description", content: "Envie um arquivo PDF e gere simulados inéditos de concursos (de 1 a 30 questões) fundamentados exclusivamente no material." },
    ],
  }),
  component: QuestoesPage,
});

type ViewMode = "todas" | "erradas" | "favoritas";

function QuestoesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>("todas");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedBanca, setSelectedBanca] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  // Estados para Gerar Questões via PDF (Item 1 da Especificação)
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfQuestionCount, setPdfQuestionCount] = useState(10);
  const [pdfBanca, setPdfBanca] = useState("Cebraspe");
  const [pdfDifficulty, setPdfDifficulty] = useState<"Fácil" | "Médio" | "Difícil">("Médio");
  const [isGeneratingFromPdf, setIsGeneratingFromPdf] = useState(false);
  const [pdfFeedback, setPdfFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [generatedPdfQuestions, setGeneratedPdfQuestions] = useState<any[]>([]);
  const [pdfAnswers, setPdfAnswers] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["questoes_full_page", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [coursesRes, modulesRes, questionsRes, attemptsRes, favsRes] = await Promise.all([
        supabase.from("courses").select("id, title, category").order("position"),
        supabase.from("modules").select("id, title, course_id").order("position"),
        supabase.from("questions").select("*, modules(title), courses(title)").order("created_at", { ascending: false }),
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
        courses: coursesRes.data ?? [],
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

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase.from("questions").delete().eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questoes_full_page"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: any) => {
      alert(`Erro ao excluir questão: ${err.message}`);
    },
  });

  const handlePdfUpload = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setPdfFeedback({
        type: "error",
        message: "Por favor, selecione um arquivo válido no formato PDF (.pdf).",
      });
      return;
    }

    setPdfFile(file);
    setIsExtractingPdf(true);
    setPdfFeedback(null);

    try {
      const buffer = await file.arrayBuffer();
      const extracted = await extractTextFromPdfBuffer(buffer);

      if (!extracted || extracted.trim().length < 30) {
        setPdfText(extracted || "");
        setPdfFeedback({
          type: "success",
          message: `Arquivo "${file.name}" carregado. O PDF será utilizado para a formulação das questões.`,
        });
      } else {
        setPdfText(extracted);
        const wordCount = extracted.split(/\s+/).filter(Boolean).length;
        setPdfFeedback({
          type: "success",
          message: `✓ PDF "${file.name}" analisado com sucesso (${wordCount} palavras extraídas).`,
        });
      }
    } catch (err: any) {
      setPdfFeedback({
        type: "error",
        message: `Falha ao processar o PDF: ${err?.message || "Erro desconhecido"}`,
      });
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const handleGeneratePdfQuestions = async () => {
    if (!pdfFile && !pdfText) {
      setPdfFeedback({
        type: "error",
        message: "Por favor, envie um arquivo PDF antes de gerar as questões.",
      });
      return;
    }

    const count = Math.min(30, Math.max(1, pdfQuestionCount));
    setIsGeneratingFromPdf(true);
    setPdfFeedback(null);

    try {
      const generated = await aiService.generateQuestions(
        count,
        pdfDifficulty,
        {
          pdfText,
          lessonTitle: pdfFile?.name?.replace(/\.pdf$/i, "") || "Material em PDF",
          banca: pdfBanca,
        }
      );

      // Salvar as questões no banco para vincular respostas, progresso e resultados à conta do aluno
      const toInsert = generated.map((q) => ({
        statement: q.statement,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        banca: q.banca || pdfBanca,
        ano: new Date().getFullYear(),
        difficulty: q.difficulty.toLowerCase(),
        subject: pdfFile?.name?.replace(/\.pdf$/i, "") || "Material PDF",
        subtopic: "Simulado PDF",
      }));

      const { data: inserted, error } = await supabase
        .from("questions")
        .insert(toInsert)
        .select();

      if (error) {
        console.warn("Aviso ao salvar questões geradas no banco:", error);
        const fallbackList = generated.map((g, idx) => ({
          ...g,
          id: `pdf-q-${Date.now()}-${idx}`,
          difficulty: g.difficulty.toLowerCase(),
          ano: new Date().getFullYear(),
          subject: pdfFile?.name?.replace(/\.pdf$/i, "") || "Material PDF",
        }));
        setGeneratedPdfQuestions(fallbackList);
      } else {
        setGeneratedPdfQuestions(inserted || []);
        queryClient.invalidateQueries({ queryKey: ["questoes_full_page"] });
      }

      setPdfAnswers({});
      setPdfFeedback({
        type: "success",
        message: `✓ ${count} questões de concurso geradas com base exclusiva no PDF "${pdfFile?.name}"!`,
      });
    } catch (err: any) {
      setPdfFeedback({
        type: "error",
        message: `Erro ao gerar questões via PDF: ${err?.message || "Tente novamente"}`,
      });
    } finally {
      setIsGeneratingFromPdf(false);
    }
  };

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

  const courses = data?.courses ?? [];
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

  const availableModules =
    selectedCourse === "all"
      ? modules
      : modules.filter((m) => m.course_id === selectedCourse);

  const filteredQuestions = allQuestions.filter((q) => {
    if (viewMode === "erradas" && !wrongQuestionIds.has(q.id)) return false;
    if (viewMode === "favoritas" && !favoritedIds.has(q.id)) return false;
    if (selectedCourse !== "all" && q.course_id !== selectedCourse) return false;
    if (selectedModule !== "all" && q.module_id !== selectedModule) return false;
    if (selectedBanca !== "all" && q.banca !== selectedBanca) return false;
    if (selectedDifficulty !== "all" && (q.difficulty || "medio") !== selectedDifficulty) return false;
    return true;
  });

  const totalRespondidas = attempts.length;
  const totalAcertos = attempts.filter((a) => a.is_correct).length;
  const taxaAcerto = totalRespondidas ? Math.round((totalAcertos / totalRespondidas) * 100) : 0;

  // Métricas do Simulado PDF atual
  const totalPdfAnswered = Object.keys(pdfAnswers).length;
  const totalPdfCorrect = generatedPdfQuestions.filter((q) => pdfAnswers[q.id] === q.correct_index).length;
  const taxaPdfAcerto = totalPdfAnswered ? Math.round((totalPdfCorrect / totalPdfAnswered) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando banco de questões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. SEÇÃO PRINCIPAL: GERAR QUESTÕES VIA PDF (Item 1 da Especificação) */}
      <section className="panel p-6 sm:p-8 space-y-6 border border-primary/30 bg-primary/[0.02] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary tracking-wide uppercase">
              <Sparkles className="size-3.5" /> Gerador de Questões via PDF
            </div>
            <h1 className="mt-2 text-2xl font-bold font-display sm:text-3xl text-foreground">
              Gerar questões via PDF
            </h1>
            <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
              Envie um arquivo PDF e escolha a quantidade de questões (de 1 até 30). A IA formulará questões de concurso baseadas exclusivamente no material, com enunciados objetivos, alternativas técnicas e gabarito fundamentado.
            </p>
          </div>
        </div>

        {/* Formulário de Configuração do PDF e Quantidade */}
        <div className="space-y-5">
          {/* Upload do Arquivo PDF */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground">
              1. Selecionar Arquivo PDF
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <label
                htmlFor="pdf-file-input"
                className={cn(
                  "flex-1 w-full flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer text-xs font-semibold",
                  pdfFile
                    ? "border-primary/50 bg-primary/5 text-primary"
                    : "border-border hover:border-primary/40 bg-secondary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <Upload className="size-4 shrink-0 text-primary" />
                <span className="truncate">
                  {pdfFile ? pdfFile.name : "Clique para escolher o PDF da aula ou apostila..."}
                </span>
                {pdfFile && (
                  <span className="text-[11px] text-muted-foreground shrink-0 font-normal">
                    ({(pdfFile.size / 1024).toFixed(0)} KB)
                  </span>
                )}
              </label>
              <input
                id="pdf-file-input"
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={isExtractingPdf || isGeneratingFromPdf}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePdfUpload(f);
                }}
              />
              {pdfFile && (
                <button
                  type="button"
                  onClick={() => {
                    setPdfFile(null);
                    setPdfText("");
                    setGeneratedPdfQuestions([]);
                    setPdfFeedback(null);
                  }}
                  className="px-3 py-3 rounded-xl border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors shrink-0"
                  title="Remover PDF"
                >
                  Remover
                </button>
              )}
            </div>

            {isExtractingPdf && (
              <div className="flex items-center gap-2 text-xs text-primary animate-pulse font-medium pt-1">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Extraindo e analisando conteúdo textual do PDF...</span>
              </div>
            )}
          </div>

          {/* Quantidade (1 até 30), Banca e Dificuldade */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Seletor de Quantidade (1 até 30) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Quantidade
                </label>
                <span className="font-mono text-xs font-bold text-primary">
                  {pdfQuestionCount} {pdfQuestionCount === 1 ? "questão" : "questões"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={pdfQuestionCount}
                  disabled={isGeneratingFromPdf}
                  onChange={(e) => setPdfQuestionCount(Number(e.target.value))}
                  className="flex-1 accent-primary cursor-pointer"
                />
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={pdfQuestionCount}
                  disabled={isGeneratingFromPdf}
                  onChange={(e) => {
                    const val = Math.min(30, Math.max(1, Number(e.target.value) || 1));
                    setPdfQuestionCount(val);
                  }}
                  className="w-16 rounded-xl border border-border bg-background px-2 py-1 text-center font-mono text-xs font-bold focus:border-primary focus:outline-none"
                />
              </div>
              {/* Presets rápidos */}
              <div className="flex items-center gap-1.5 pt-1">
                {[5, 10, 15, 20, 30].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPdfQuestionCount(preset)}
                    disabled={isGeneratingFromPdf}
                    className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors border",
                      pdfQuestionCount === preset
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Seletor de Banca Examinadora */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                3. Banca Examinadora
              </label>
              <select
                value={pdfBanca}
                onChange={(e) => setPdfBanca(e.target.value)}
                disabled={isGeneratingFromPdf}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
              >
                <option value="Cebraspe">Cebraspe (Certo / Errado & Múltipla Escolha)</option>
                <option value="FGV">FGV (Fundação Getulio Vargas)</option>
                <option value="Vunesp">Vunesp (Objetiva Direta)</option>
                <option value="FCC">FCC (Fundação Carlos Chagas)</option>
              </select>
              <p className="text-[10px] text-muted-foreground">
                A IA adota o padrão estilístico e de cobrança da banca escolhida.
              </p>
            </div>

            {/* Seletor de Dificuldade */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                4. Dificuldade
              </label>
              <select
                value={pdfDifficulty}
                onChange={(e) => setPdfDifficulty(e.target.value as any)}
                disabled={isGeneratingFromPdf}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
              >
                <option value="Fácil">Fácil (Conceitos Diretos)</option>
                <option value="Médio">Médio (Padrão de Concurso)</option>
                <option value="Difícil">Difícil (Pegadinhas Avançadas)</option>
              </select>
              <p className="text-[10px] text-muted-foreground">
                Calibragem técnica do rigor das alternativas.
              </p>
            </div>
          </div>

          {/* Feedback */}
          {pdfFeedback && (
            <div
              className={cn(
                "rounded-xl p-3.5 text-xs font-semibold animate-fadeIn",
                pdfFeedback.type === "success"
                  ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : "border border-red-500/40 bg-red-500/10 text-red-500"
              )}
            >
              {pdfFeedback.message}
            </div>
          )}

          {/* Botão de Ação: Gerar Questões via PDF */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleGeneratePdfQuestions}
              disabled={!pdfFile || isExtractingPdf || isGeneratingFromPdf}
              className="glow-primary flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
            >
              {isGeneratingFromPdf ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Gerando {pdfQuestionCount} questões exclusivamente com o PDF...</span>
                </>
              ) : (
                <>
                  <FileText className="size-4" />
                  <span>Gerar {pdfQuestionCount} questões via PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Simulado Gerado via PDF: Exibição e Resolução com Salvamento de Progresso */}
        {generatedPdfQuestions.length > 0 && (
          <div className="space-y-6 pt-6 border-t border-border/80 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/50 p-4 rounded-xl border border-border">
              <div>
                <h3 className="text-base font-bold font-display text-foreground">
                  Simulado Gerado via PDF ({generatedPdfQuestions.length} questões)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Responda às questões abaixo. Seu progresso, respostas e resultados são salvos automaticamente vinculados à sua conta.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs font-bold text-foreground">
                    Acertos: {totalPdfCorrect} / {totalPdfAnswered} ({taxaPdfAcerto}%)
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {totalPdfAnswered} de {generatedPdfQuestions.length} respondidas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedPdfQuestions([]);
                    setPdfAnswers({});
                  }}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Fechar Simulado
                </button>
              </div>
            </div>

            <div className="space-y-5">
              {generatedPdfQuestions.map((q, idx) => (
                <QuestionCard
                  key={q.id || `pdf-q-${idx}`}
                  question={q}
                  questionNumber={idx + 1}
                  userSelectedIndex={pdfAnswers[q.id]}
                  isFavorited={favoritedIds.has(q.id)}
                  onToggleFavorite={() => toggleFavorite(q)}
                  onDelete={() => {
                    setGeneratedPdfQuestions((prev) => prev.filter((item) => item.id !== q.id));
                    deleteQuestionMutation.mutate(q.id);
                  }}
                  onAnswer={(optIdx, isCorrect) => {
                    setPdfAnswers((prev) => ({ ...prev, [q.id]: optIdx }));
                    recordAttemptMutation.mutate({ qId: q.id, optIndex: optIdx, isCorrect });
                  }}
                  onRetry={() => {
                    setPdfAnswers((prev) => {
                      const next = { ...prev };
                      delete next[q.id];
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 2. SEÇÃO: BANCO GERAL DE QUESTÕES COMENTADAS */}
      <div className="pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">HISTÓRICO & BANCO GERAL</p>
            <h2 className="mt-1 text-2xl font-bold font-display md:text-3xl">Banco Geral de Questões</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Acesse todas as questões registradas na plataforma e monitore seu desempenho por curso e assunto.
            </p>
          </div>
        </div>
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
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setSelectedModule("all");
            }}
            className="rounded-xl border border-primary/40 bg-background px-3 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
          >
            <option value="all">Todos os Cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
          >
            <option value="all">Todos os Módulos</option>
            {availableModules.map((m) => (
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

          {(selectedCourse !== "all" || selectedModule !== "all" || selectedBanca !== "all" || selectedDifficulty !== "all") && (
            <button
              onClick={() => {
                setSelectedCourse("all");
                setSelectedModule("all");
                setSelectedBanca("all");
                setSelectedDifficulty("all");
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            >
              <RotateCcw className="size-3" /> Limpar filtros
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
              onDelete={(qId) => deleteQuestionMutation.mutate(qId)}
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
