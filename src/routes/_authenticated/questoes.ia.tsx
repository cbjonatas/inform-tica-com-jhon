import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FolderGit2,
  GraduationCap,
  HelpCircle,
  Loader2,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { aiService } from "@/lib/ai/ai-service";

export const Route = createFileRoute("/_authenticated/questoes/ia")({
  validateSearch: (search: Record<string, unknown>): { cursoId?: string; moduloId?: string; aulaId?: string } => ({
    ...(typeof search.cursoId === "string" ? { cursoId: search.cursoId } : {}),
    ...(typeof search.moduloId === "string" ? { moduloId: search.moduloId } : {}),
    ...(typeof search.aulaId === "string" ? { aulaId: search.aulaId } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Gerador de Questões IA por Curso — Informática com Jhon" },
      { name: "description", content: "Gere simulados e questões inéditas de informática isoladas pelo contexto de cada curso." },
    ],
  }),
  component: GeradorQuestoesIaPage,
});

interface GeneratedQuestion {
  id: string;
  statement: string;
  options: string[];
  correct_index: number;
  explanation: string;
  banca: string;
  difficulty: "Fácil" | "Médio" | "Difícil";
  subject: string;
  course_id?: string;
  module_id?: string;
  lesson_id?: string;
}

function GeradorQuestoesIaPage() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const search = Route.useSearch();

  // Filtros em Cascata:
  // CURSO -> MÓDULO -> AULA -> ASSUNTO -> QUANTIDADE -> DIFICULDADE
  const [selectedCourse, setSelectedCourse] = useState<string>(search.cursoId || "");
  const [selectedModule, setSelectedModule] = useState<string>(search.moduloId || "");
  const [selectedLesson, setSelectedLesson] = useState<string>(search.aulaId || "");
  const [subject, setSubject] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<"Fácil" | "Médio" | "Difícil">("Médio");

  // Estados de Geração e Respostas
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [isSavingToBank, setIsSavingToBank] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // 1. Buscar Cursos disponíveis
  const { data: courses = [] } = useQuery({
    queryKey: ["courses_for_ia_quiz", user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase.from("courses").select("id, title, category, status").order("position");
      if (!isAdmin) {
        query = query.eq("status", "published");
      }
      const res = await query;
      return res.data ?? [];
    },
  });

  // 2. Buscar Módulos do Curso selecionado
  const { data: modules = [] } = useQuery({
    queryKey: ["modules_for_ia_quiz", selectedCourse],
    enabled: Boolean(selectedCourse),
    queryFn: async () => {
      const res = await supabase
        .from("modules")
        .select("id, title, position, course_id")
        .eq("course_id", selectedCourse)
        .order("position");
      return res.data ?? [];
    },
  });

  // 3. Buscar Aulas do Módulo selecionado
  const { data: lessons = [] } = useQuery({
    queryKey: ["lessons_for_ia_quiz", selectedModule],
    enabled: Boolean(selectedModule),
    queryFn: async () => {
      const res = await supabase
        .from("lessons")
        .select("id, title, position, module_id")
        .eq("module_id", selectedModule)
        .order("position");
      return res.data ?? [];
    },
  });

  // Geração de questões com IA contextualizada pelo curso e aula escolhidos
  const handleGenerate = async () => {
    if (!selectedCourse) return;
    setIsGenerating(true);
    setUserAnswers({});
    setSavedSuccess(false);

    try {
      const activeCourseTitle = courses.find((c) => c.id === selectedCourse)?.title || "Curso Selecionado";
      const activeModuleTitle = modules.find((m) => m.id === selectedModule)?.title || "Informática Geral";
      const activeLesson = lessons.find((l) => l.id === selectedLesson);

      let contextTranscript = "";
      let contextDescription = "";
      let contextMaterials = "";
      let contextTitle = activeLesson?.title || "";
      let contextPart: number | undefined;

      if (selectedLesson) {
        const { data: lessonData } = await supabase
          .from("lessons")
          .select("id, title, description, transcript, part, materials")
          .eq("id", selectedLesson)
          .maybeSingle();

        if (lessonData) {
          contextTitle = lessonData.title || contextTitle;
          contextDescription = lessonData.description || "";
          contextTranscript = lessonData.transcript || "";
          contextPart = lessonData.part || undefined;
          if (Array.isArray(lessonData.materials)) {
            contextMaterials = lessonData.materials
              .map((m: any) => m.name || m.title || "")
              .filter(Boolean)
              .join(", ");
          }
        }
      }

      const activeLessonTitle = contextTitle || subject || "Conceitos Fundamentais";
      const chosenDifficulty = difficulty.toLowerCase() === "fácil" ? "facil" : difficulty.toLowerCase() === "difícil" ? "dificil" : "medio";

      const generated = await aiService.generateQuestions(
        quantity,
        chosenDifficulty,
        {
          courseTitle: activeCourseTitle,
          moduleTitle: activeModuleTitle,
          lessonTitle: activeLessonTitle,
          subject: subject || activeModuleTitle || activeLessonTitle,
          transcript: contextTranscript,
          description: contextDescription,
          materialsText: contextMaterials,
          part: contextPart,
          banca: banca.trim() ? banca : `Simulado IA — ${activeCourseTitle}`,
        }
      );

      const formatted: GeneratedQuestion[] = generated.map((q, idx) => ({
        id: `ia-${Date.now()}-${idx}`,
        course_id: selectedCourse,
        module_id: selectedModule || undefined,
        lesson_id: selectedLesson || undefined,
        subject: subject || activeModuleTitle,
        difficulty,
        banca: banca.trim() ? banca : `Simulado IA — ${activeCourseTitle}`,
        statement: q.statement,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
      }));

      setGeneratedQuestions(formatted);
    } catch (err) {
      console.error("Erro ao gerar questões com IA:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = async (qId: string, optIndex: number, correctIndex: number) => {
    setUserAnswers((prev) => ({ ...prev, [qId]: optIndex }));

    if (user?.id) {
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qId);
      if (isValidUuid) {
        await supabase.from("question_attempts").insert({
          user_id: user.id,
          question_id: qId,
          selected_index: optIndex,
          is_correct: optIndex === correctIndex,
        });
        queryClient.invalidateQueries({ queryKey: ["dashboard-multicourse"] });
      }
    }
  };

  // Excluir ou remover questão
  const handleRemoveQuestion = async (qId: string) => {
    if (!window.confirm("Deseja realmente excluir esta questão da plataforma?")) return;

    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qId);
    if (isValidUuid) {
      await supabase.from("questions").delete().eq("id", qId);
      queryClient.invalidateQueries({ queryKey: ["questoes_full_page"] });
    }

    setGeneratedQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  // Salvar no Banco de Questões do Curso (Item 4 da especificação)
  const handleSaveToCourseBank = async () => {
    if (!selectedCourse || generatedQuestions.length === 0) return;
    setIsSavingToBank(true);

    const questionsToInsert = generatedQuestions.map((q) => ({
      course_id: selectedCourse,
      module_id: selectedModule || null,
      lesson_id: selectedLesson || null,
      statement: q.statement,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
      banca: q.banca,
      difficulty: q.difficulty.toLowerCase() === "fácil" ? "facil" : q.difficulty.toLowerCase() === "difícil" ? "dificil" : "medio",
      subject: q.subject,
      ano: new Date().getFullYear(),
    }));

    const { data: insertedData } = await supabase.from("questions").insert(questionsToInsert).select("id");
    if (insertedData && insertedData.length > 0) {
      setGeneratedQuestions((prev) =>
        prev.map((q, i) => ({
          ...q,
          id: insertedData[i]?.id || q.id,
        }))
      );
    }

    setIsSavingToBank(false);
    setSavedSuccess(true);
    queryClient.invalidateQueries({ queryKey: ["questoes_full_page"] });
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Topo */}
      <div>
        <Link
          to="/questoes"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao banco de questões
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <div className="grid size-10 place-items-center rounded-xl bg-accent/20 text-accent">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display">GERADOR DE QUESTÕES IA</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Gere questões contextualizadas estritamente pelo curso e edital escolhido.
            </p>
          </div>
        </div>
      </div>

      {/* Formulário em Cascata: CURSO -> MÓDULO -> AULA -> ASSUNTO */}
      <section className="panel p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold font-display flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Parâmetros de Geração Contextual
          </h2>
          <Badge variant="outline" className="text-[11px]">
            {courses.length} cursos cadastrados
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* 1. SELETOR DE CURSO (Obrigatório) */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-primary mb-1.5 flex items-center gap-1.5">
              <GraduationCap className="size-3.5" /> 1. Curso (Obrigatório)
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setSelectedModule("");
                setSelectedLesson("");
              }}
              className="w-full rounded-xl border border-primary/40 bg-background px-4 py-2.5 text-sm font-semibold focus:border-primary focus:outline-none"
            >
              <option value="">Selecione o Curso para contextualizar a IA...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.category})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              A IA utilizará apenas os conteúdos, matérias e edital do curso selecionado.
            </p>
          </div>

          {/* 2. SELETOR DE MÓDULO */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              2. Módulo do Curso
            </label>
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setSelectedLesson("");
              }}
              disabled={!selectedCourse}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
            >
              <option value="">Todos os Módulos deste Curso</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  Módulo {m.position} — {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* 3. SELETOR DE AULA */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              3. Aula Específica (Opcional)
            </label>
            <select
              value={selectedLesson}
              onChange={(e) => setSelectedLesson(e.target.value)}
              disabled={!selectedModule}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
            >
              <option value="">Todo o Módulo</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  Aula {l.position} — {l.title}
                </option>
              ))}
            </select>
          </div>

          {/* 4. ASSUNTO OU PALAVRA-CHAVE */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              4. Assunto / Tópico Específico
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Topologias de Rede, Permissões Linux, Malware..."
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* 5. QUANTIDADE */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              5. Quantidade de Questões
            </label>
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value={3}>3 questões</option>
              <option value={5}>5 questões</option>
              <option value={10}>10 questões</option>
            </select>
          </div>

          {/* 6. DIFICULDADE */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              6. Nível de Dificuldade
            </label>
            <div className="flex gap-3">
              {(["Fácil", "Médio", "Difícil"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDifficulty(lvl)}
                  className={cn(
                    "flex-1 rounded-xl py-2 text-xs font-bold transition-all border",
                    difficulty === lvl
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary"
                  )}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Botão de Geração */}
        <button
          onClick={handleGenerate}
          disabled={!selectedCourse || isGenerating}
          className="glow-primary flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              PROCESSANDO CONTEXTO DO CURSO COM IA...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              GERAR QUESTÕES COM IA
            </>
          )}
        </button>

        {!selectedCourse && (
          <p className="text-center text-xs text-amber-500 font-medium">
            ⚠ Selecione um curso acima para habilitar o gerador com IA.
          </p>
        )}
      </section>

      {/* Questões Geradas */}
      {generatedQuestions.length > 0 && (
        <section className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-lg font-bold font-display">
                Questões Geradas ({generatedQuestions.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Resolva o simulado e confira o gabarito comentado instantaneamente.
              </p>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveToCourseBank}
                  disabled={isSavingToBank || savedSuccess}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isSavingToBank ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Salvando...
                    </>
                  ) : savedSuccess ? (
                    <>
                      <CheckCircle2 className="size-3.5" /> Salvas no Curso!
                    </>
                  ) : (
                    <>
                      <PlusCircle className="size-3.5" /> Salvar no Banco do Curso
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {generatedQuestions.map((q, idx) => {
              const answeredIndex = userAnswers[q.id];
              const isAnswered = answeredIndex !== undefined;

              return (
                <div key={q.id} className="panel p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-xs">
                    <span className="font-bold text-accent">QUESTÃO {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {q.banca}
                      </span>
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-bold",
                          q.difficulty === "Fácil" && "bg-emerald-500/10 text-emerald-500",
                          q.difficulty === "Médio" && "bg-amber-500/10 text-amber-500",
                          q.difficulty === "Difícil" && "bg-rose-500/10 text-rose-500"
                        )}
                      >
                        {q.difficulty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(q.id)}
                        title="Excluir questão da plataforma"
                        className="rounded-lg p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors ml-1"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  <p className="font-medium text-sm leading-relaxed">{q.statement}</p>

                  <div className="space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isSelected = answeredIndex === optIdx;
                      const isCorrectOpt = optIdx === q.correct_index;

                      let btnStyle = "border-border hover:bg-secondary/60";
                      if (isAnswered) {
                        if (isCorrectOpt) {
                          btnStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold";
                        } else if (isSelected && !isCorrectOpt) {
                          btnStyle = "border-rose-500 bg-rose-500/10 text-rose-400";
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          onClick={() => !isAnswered && handleAnswer(q.id, optIdx, q.correct_index)}
                          disabled={isAnswered}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border p-3 text-left text-xs transition-colors",
                            btnStyle
                          )}
                        >
                          <span className="grid size-5 shrink-0 place-items-center rounded-md bg-secondary font-bold text-[11px]">
                            {letter}
                          </span>
                          <span className="mt-0.5 leading-relaxed">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {isAnswered && (
                    <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2 text-xs animate-in fade-in-50">
                      <div className="flex items-center gap-2 font-bold">
                        {answeredIndex === q.correct_index ? (
                          <span className="text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="size-4" /> Resposta Correta!
                          </span>
                        ) : (
                          <span className="text-rose-500 flex items-center gap-1">
                            <XCircle className="size-4" /> Resposta Incorreta (Gabarito: Letra {String.fromCharCode(65 + q.correct_index)})
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
export default GeradorQuestoesIaPage;
