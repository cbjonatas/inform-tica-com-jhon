import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileEdit,
  FileText,
  HelpCircle,
  Lightbulb,
  Play,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { VideoPlayer, type VideoPlayerRef } from "@/components/VideoPlayer";
import { TranscriptViewer } from "@/components/TranscriptViewer";
import { QuestionCard } from "@/components/QuestionCard";
import { PdfViewer } from "@/components/PdfViewer";
import { AIChat } from "@/components/AIChat";
import { aiService } from "@/lib/ai/ai-service";

export const Route = createFileRoute("/_authenticated/curso/aula/$aulaId")({
  head: () => ({
    meta: [
      { title: "Aula — Informática com Jhon" },
      { name: "description", content: "Assista a videoaula, veja transcrição inteligente, resumo de IA e materiais." },
    ],
  }),
  component: AulaDetailPage,
});

type ActiveTab =
  | "descricao"
  | "transcricao"
  | "pdf"
  | "questoes"
  | "resumo"
  | "anotacoes"
  | "ia";

function AulaDetailPage() {
  const { aulaId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>("descricao");
  const playerRef = useRef<VideoPlayerRef | null>(null);

  // Estados de Anotações
  const [newNote, setNewNote] = useState("");
  const [attachTimestamp, setAttachTimestamp] = useState(true);

  // Estados de Resumo de IA
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<any | null>(null);
  const [summarySaved, setSummarySaved] = useState(false);

  // Favorito da aula
  const [isFavorited, setIsFavorited] = useState(false);

  // Respostas de questões
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["aula_detail", aulaId, user?.id],
    enabled: Boolean(aulaId && user?.id),
    queryFn: async () => {
      const [lessonRes, progressRes, materialsRes, notesRes, favRes, summaryRes] = await Promise.all([
        supabase.from("lessons").select("*, modules(*)").eq("id", aulaId).maybeSingle(),
        supabase.from("lesson_progress").select("*").eq("lesson_id", aulaId).maybeSingle(),
        supabase.from("materials").select("*").eq("lesson_id", aulaId),
        supabase.from("notes").select("*").eq("lesson_id", aulaId).order("created_at", { ascending: false }),
        supabase.from("favorites").select("id").eq("item_type", "lesson").eq("item_id", aulaId).maybeSingle(),
        supabase.from("summaries").select("*").eq("lesson_id", aulaId).maybeSingle(),
      ]);

      const lesson = lessonRes.data;
      if (!lesson) return null;

      const siblingsRes = await supabase
        .from("lessons")
        .select("id, title, position")
        .eq("module_id", lesson.module_id)
        .order("position");

      const questionsRes = await supabase
        .from("questions")
        .select("*")
        .or(`lesson_id.eq.${aulaId},module_id.eq.${lesson.module_id}`);

      setIsFavorited(Boolean(favRes.data));

      if (summaryRes.data) {
        setGeneratedSummary({
          resumo: summaryRes.data.summary_text,
          conceitos: summaryRes.data.key_concepts || [],
          pontos: summaryRes.data.important_points || [],
          pegadinhas: summaryRes.data.exam_traps || [],
          prova: summaryRes.data.likely_questions || [],
        });
      }

      return {
        lesson,
        module: lesson.modules,
        siblings: siblingsRes.data ?? [],
        progress: progressRes.data,
        materials: materialsRes.data ?? [],
        notes: notesRes.data ?? [],
        questions: questionsRes.data ?? [],
      };
    },
  });

  const lesson = data?.lesson;
  const moduleData = data?.module;
  const siblings = data?.siblings ?? [];
  const progress = data?.progress;
  const questions = data?.questions ?? [];
  const materials = data?.materials ?? [];
  const notes = data?.notes ?? [];

  // Timestamps da transcrição
  const timestamps =
    lesson?.transcript_timestamps && Array.isArray(lesson.transcript_timestamps) && lesson.transcript_timestamps.length > 0
      ? lesson.transcript_timestamps
      : [
          { time: 0, label: "00:00 — Introdução ao Tema", text: "Apresentação dos conceitos essenciais para concursos." },
          { time: 90, label: "01:30 — Definições e Classificações", text: "Pontos conceituais cobrados nas bancas." },
          { time: 240, label: "04:00 — Pegadinhas Recorrentes", text: "Armadilhas frequentes em enunciados recentes." },
          { time: 420, label: "07:00 — Revisão e Fixação", text: "Direcionamento para resolução de questões." },
        ];

  // Salvar progresso no banco
  const saveProgressMutation = useMutation({
    mutationFn: async ({ pos, completed }: { pos: number; completed?: boolean }) => {
      if (!user?.id || !aulaId) return;
      const payload: any = {
        user_id: user.id,
        lesson_id: aulaId,
        position_seconds: Math.floor(pos),
        updated_at: new Date().toISOString(),
      };
      if (completed !== undefined) payload.completed = completed;
      await supabase.from("lesson_progress").upsert(payload, { onConflict: "user_id,lesson_id" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aula_detail", aulaId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // Favoritar / Desfavoritar Aula
  const toggleFavoriteLesson = async () => {
    if (!user?.id || !lesson) return;
    if (isFavorited) {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("item_type", "lesson")
        .eq("item_id", lesson.id);
      setIsFavorited(false);
    } else {
      await supabase.from("favorites").insert({
        user_id: user.id,
        item_type: "lesson",
        item_id: lesson.id,
        title: lesson.title,
        subtitle: moduleData?.title || "Módulo",
      });
      setIsFavorited(true);
    }
    queryClient.invalidateQueries({ queryKey: ["user_favorites"] });
  };

  // Adicionar Anotação
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !user?.id) return;

    const currentTime = playerRef.current?.getCurrentTime() || 0;
    const timeSecs = attachTimestamp ? Math.floor(currentTime) : 0;

    await supabase.from("notes").insert({
      user_id: user.id,
      lesson_id: aulaId,
      timestamp_seconds: timeSecs,
      content: newNote.trim(),
    });

    setNewNote("");
    queryClient.invalidateQueries({ queryKey: ["aula_detail", aulaId] });
  };

  const handleDeleteNote = async (noteId: string) => {
    await supabase.from("notes").delete().eq("id", noteId);
    queryClient.invalidateQueries({ queryKey: ["aula_detail", aulaId] });
  };

  // Gerar Resumo com IA
  const handleGenerateSummary = async () => {
    if (!lesson) return;
    setIsGeneratingSummary(true);
    const sum = await aiService.generateSummary({
      lessonTitle: lesson.title,
      transcript: lesson.transcript,
    });
    setGeneratedSummary(sum);
    setIsGeneratingSummary(false);
  };

  const handleSaveSummary = async () => {
    if (!user?.id || !lesson) return;
    await supabase.from("favorites").insert({
      user_id: user.id,
      item_type: "summary",
      item_id: lesson.id,
      title: `Resumo IA — ${lesson.title}`,
      subtitle: moduleData?.title || "Módulo",
    });
    setSummarySaved(true);
    setTimeout(() => setSummarySaved(false), 2500);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const currentIndex = siblings.findIndex((s) => s.id === aulaId);
  const prevLesson = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextLesson = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando aula...</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="panel p-8 text-center space-y-4">
        <p className="text-lg font-semibold">Aula não encontrada.</p>
        <Link to="/curso" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" /> Voltar ao curso
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. TOPO: Identificação e Navegação (Item 34) */}
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <Link
              to="/curso/modulo/$moduloId"
              params={{ moduloId: lesson.module_id }}
              className="hover:text-primary transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="size-3.5" />
              {moduleData?.title || "Módulo"}
            </Link>
            <span>•</span>
            <span className="text-accent">Aula {lesson.position}</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold md:text-3xl font-display">{lesson.title}</h1>
            <button
              onClick={toggleFavoriteLesson}
              className={cn(
                "p-1.5 rounded-xl transition-colors",
                isFavorited ? "text-amber-400 bg-amber-400/10" : "text-muted-foreground hover:text-foreground"
              )}
              title={isFavorited ? "Remover dos favoritos" : "Salvar nos favoritos"}
            >
              <Star className={cn("size-5", isFavorited && "fill-current")} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() =>
              saveProgressMutation.mutate({
                pos: playerRef.current?.getCurrentTime() || 0,
                completed: !progress?.completed,
              })
            }
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all border",
              progress?.completed
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                : "bg-secondary text-foreground border-border hover:bg-secondary/80"
            )}
          >
            <CheckCircle2 className="size-4" />
            {progress?.completed ? "Concluída" : "Marcar como concluída"}
          </button>

          {prevLesson && (
            <Link
              to="/curso/aula/$aulaId"
              params={{ aulaId: prevLesson.id }}
              className="flex size-9 items-center justify-center rounded-xl border border-border bg-secondary text-foreground hover:bg-secondary/80"
              title={`Anterior: ${prevLesson.title}`}
            >
              <ChevronLeft className="size-4" />
            </Link>
          )}

          {nextLesson && (
            <Link
              to="/curso/aula/$aulaId"
              params={{ aulaId: nextLesson.id }}
              className="flex size-9 items-center justify-center rounded-xl border border-border bg-secondary text-foreground hover:bg-secondary/80"
              title={`Próxima: ${nextLesson.title}`}
            >
              <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
      </header>

      {/* 2. PLAYER DE VÍDEO (Item 34 e 35) */}
      <VideoPlayer
        ref={playerRef}
        src={lesson.video_url || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}
        initialPosition={progress?.position_seconds || 0}
        onTimeUpdateThrottled={(pos) => saveProgressMutation.mutate({ pos })}
        onEnded={() => saveProgressMutation.mutate({ pos: 9999, completed: true })}
      />

      {/* 3. ABAS DINÂMICAS DE CONTEÚDO */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2 overflow-x-auto">
          {[
            { id: "descricao", label: "DESCRIÇÃO", icon: FileText },
            { id: "transcricao", label: "TRANSCRIÇÃO INTELIGENTE", icon: FileText },
            { id: "pdf", label: "PDF & MATERIAIS", icon: Download },
            { id: "questoes", label: "QUESTÕES", icon: HelpCircle, count: questions.length },
            { id: "resumo", label: "RESUMO IA", icon: Lightbulb },
            { id: "anotacoes", label: "MINHAS ANOTAÇÕES", icon: FileEdit, count: notes.length },
            { id: "ia", label: "PERGUNTE À IA", icon: Sparkles },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold tracking-wide transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <tab.icon className="size-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "ml-1 rounded-full px-1.5 py-0.2 text-[10px]",
                    activeTab === tab.id ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Conteúdo da Aba */}
        <div className="panel p-6 min-h-[300px]">
          {/* ABA 1: DESCRIÇÃO */}
          {activeTab === "descricao" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-display">{lesson.title}</h2>
              <p className="text-muted-foreground leading-relaxed text-sm">
                {lesson.description ||
                  "Nesta videoaula exclusiva de Informática para Concursos, o professor Jhon aborda os conceitos essenciais cobrados nas provas, destacando atalhos e armadilhas frequentes."}
              </p>
            </div>
          )}

          {/* ABA 2: TRANSCRIÇÃO INTELIGENTE */}
          {activeTab === "transcricao" && (
            <TranscriptViewer
              timestamps={timestamps}
              onSeek={(secs) => playerRef.current?.seekTo(secs)}
            />
          )}

          {/* ABA 3: PDF & MATERIAIS */}
          {activeTab === "pdf" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold font-display">Apostilas e Materiais da Aula</h3>
                <Link to="/materiais" className="text-xs text-primary hover:underline">
                  Ver todos os materiais do curso
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 mt-4">
                {lesson.pdf_url && (
                  <PdfViewer
                    title="Apostila Oficial da Aula (PDF)"
                    subtitle="Material oficial de estudo"
                    pdfUrl={lesson.pdf_url}
                  />
                )}

                {materials.map((m) => (
                  <PdfViewer
                    key={m.id}
                    title={m.title}
                    subtitle="Material complementar"
                    pdfUrl={m.file_url}
                  />
                ))}

                {!lesson.pdf_url && materials.length === 0 && (
                  <p className="text-xs text-muted-foreground col-span-full py-6 text-center">
                    Nenhum arquivo PDF anexado diretamente para esta aula.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ABA 4: QUESTÕES */}
          {activeTab === "questoes" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-display">Questões desta Videoaula</h3>
                  <p className="text-xs text-muted-foreground">Resolva e confira o comentário imediato.</p>
                </div>
                <Link to="/questoes/ia" className="text-xs text-accent font-semibold hover:underline flex items-center gap-1">
                  <Sparkles className="size-3.5" /> Gerar mais questões com IA
                </Link>
              </div>

              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    questionNumber={idx + 1}
                    userSelectedIndex={userAnswers[q.id]}
                    onAnswer={async (selIdx, isCorrect) => {
                      setUserAnswers((prev) => ({ ...prev, [q.id]: selIdx }));
                      if (user?.id) {
                        await supabase.from("question_attempts").insert({
                          user_id: user.id,
                          question_id: q.id,
                          selected_index: selIdx,
                          is_correct: isCorrect,
                        });
                      }
                    }}
                    onRetry={() => {
                      setUserAnswers((prev) => {
                        const next = { ...prev };
                        delete next[q.id];
                        return next;
                      });
                    }}
                  />
                ))}

                {questions.length === 0 && (
                  <p className="text-xs text-muted-foreground py-8 text-center">
                    Nenhuma questão cadastrada diretamente nesta aula. Acesse o menu Questões para simulados completos.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ABA 5: RESUMO COM IA */}
          {activeTab === "resumo" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold font-display flex items-center gap-2">
                    <Sparkles className="size-5 text-accent" /> Síntese & Resumo da Aula por IA
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Conceitos principais, pegadinhas de bancas e o que pode cair na prova.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {generatedSummary && (
                    <button
                      onClick={handleSaveSummary}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary/80"
                    >
                      <Bookmark className="size-3.5" />
                      {summarySaved ? "✓ Resumo Salvo!" : "Salvar Resumo"}
                    </button>
                  )}
                  <button
                    onClick={handleGenerateSummary}
                    disabled={isGeneratingSummary}
                    className="glow-primary flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <Sparkles className="size-3.5" />
                    {isGeneratingSummary ? "Gerando resumo..." : "GERAR RESUMO COM IA"}
                  </button>
                </div>
              </div>

              {generatedSummary ? (
                <div className="space-y-4">
                  <div className="panel p-4 space-y-1.5 border-l-4 border-l-primary">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent">Resumo da Aula</h4>
                    <p className="text-xs text-foreground leading-relaxed">{generatedSummary.resumo}</p>
                  </div>

                  <div className="panel p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" /> Principais Conceitos
                    </h4>
                    <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                      {generatedSummary.conceitos.map((c: string, i: number) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="panel p-4 space-y-2 border-l-4 border-l-red-500 bg-red-500/5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-1.5">
                      <ShieldAlert className="size-4" /> Pegadinhas Clássicas de Concurso
                    </h4>
                    <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                      {generatedSummary.pegadinhas.map((g: string, i: number) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="panel p-10 text-center space-y-3">
                  <Sparkles className="size-10 mx-auto text-accent/50" />
                  <p className="text-sm font-semibold">Resumo ainda não gerado para esta aula.</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Clique no botão acima para a IA analisar o conteúdo e sintetizar as armadilhas e pontos críticos.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ABA 6: MINHAS ANOTAÇÕES */}
          {activeTab === "anotacoes" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold font-display">Minhas Anotações</h3>
                <p className="text-xs text-muted-foreground">
                  Escreva seus apontamentos vinculados ao momento exato da aula.
                </p>
              </div>

              <form onSubmit={handleAddNote} className="panel p-4 space-y-3 border border-border">
                <textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Escreva sua anotação..."
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:border-primary focus:outline-none"
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attachTimestamp}
                      onChange={(e) => setAttachTimestamp(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span>Vincular ao momento atual do vídeo</span>
                  </label>

                  <button
                    type="submit"
                    disabled={!newNote.trim()}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Salvar Anotação
                  </button>
                </div>
              </form>

              <div className="space-y-2.5">
                {notes.map((note: any) => (
                  <div
                    key={note.id}
                    className="panel flex items-start justify-between gap-4 p-4 border border-border"
                  >
                    <div className="space-y-1">
                      {note.timestamp_seconds > 0 && (
                        <button
                          onClick={() => playerRef.current?.seekTo(note.timestamp_seconds)}
                          className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-primary hover:underline"
                        >
                          <Play className="size-3 fill-current" /> {formatTime(note.timestamp_seconds)}
                        </button>
                      )}
                      <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-muted-foreground hover:text-red-500 p-1"
                      title="Excluir"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 7: PERGUNTE À IA */}
          {activeTab === "ia" && (
            <AIChat
              contextTitle={lesson.title}
              contextType={moduleData?.title || "Aula"}
              onSendMessage={(prompt) =>
                aiService.askTutor(prompt, {
                  lessonTitle: lesson.title,
                  moduleTitle: moduleData?.title,
                  transcript: lesson.transcript,
                })
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}
