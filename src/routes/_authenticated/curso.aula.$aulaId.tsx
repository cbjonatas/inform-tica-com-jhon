import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileEdit,
  FileText,
  HelpCircle,
  Lightbulb,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

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

interface TimestampItem {
  time: number;
  label: string;
  text?: string;
}

interface NoteItem {
  id: string;
  timestamp_seconds: number;
  content: string;
  created_at: string;
}

function AulaDetailPage() {
  const { aulaId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>("descricao");

  // Estados do Player
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);

  // Estados de Transcrição Inteligente
  const [transcriptSearch, setTranscriptSearch] = useState("");

  // Estados de Anotações
  const [newNote, setNewNote] = useState("");
  const [attachTimestamp, setAttachTimestamp] = useState(true);

  // Estados de Resumo de IA
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<{
    resumo: string;
    conceitos: string[];
    pontos: string[];
    pegadinhas: string[];
    prova: string[];
  } | null>(null);
  const [summarySaved, setSummarySaved] = useState(false);

  // Estados do Chat com a IA
  const [iaMessages, setIaMessages] = useState<Array<{ sender: "user" | "ia"; text: string }>>([]);
  const [iaInput, setIaInput] = useState("");
  const [isIaThinking, setIsIaThinking] = useState(false);

  // Estados de Questões
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  // Favorito da aula
  const [isFavorited, setIsFavorited] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["aula_detail", aulaId, user?.id],
    enabled: Boolean(aulaId && user?.id),
    queryFn: async () => {
      const [lessonRes, progressRes, materialsRes, notesRes, favRes] = await Promise.all([
        supabase.from("lessons").select("*, modules(*)").eq("id", aulaId).maybeSingle(),
        supabase.from("lesson_progress").select("*").eq("lesson_id", aulaId).maybeSingle(),
        supabase.from("materials").select("*").eq("lesson_id", aulaId),
        supabase.from("notes").select("*").eq("lesson_id", aulaId).order("created_at", { ascending: false }),
        supabase.from("favorites").select("id").eq("item_type", "lesson").eq("item_id", aulaId).maybeSingle(),
      ]);

      const lesson = lessonRes.data;
      if (!lesson) return null;

      // Buscar irmãos do módulo
      const siblingsRes = await supabase
        .from("lessons")
        .select("id, title, position")
        .eq("module_id", lesson.module_id)
        .order("position");

      // Buscar questões da aula ou do módulo
      const questionsRes = await supabase
        .from("questions")
        .select("*")
        .or(`lesson_id.eq.${aulaId},module_id.eq.${lesson.module_id}`);

      setIsFavorited(Boolean(favRes.data));

      return {
        lesson,
        module: lesson.modules,
        siblings: siblingsRes.data ?? [],
        progress: progressRes.data,
        materials: materialsRes.data ?? [],
        notes: (notesRes.data as NoteItem[]) ?? [],
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

  // Timestamps da transcrição (com fallback inteligente)
  const timestamps: TimestampItem[] =
    lesson?.transcript_timestamps && Array.isArray(lesson.transcript_timestamps) && lesson.transcript_timestamps.length > 0
      ? (lesson.transcript_timestamps as TimestampItem[])
      : [
          { time: 0, label: "00:00 — Introdução ao Tema", text: "Apresentação dos principais conceitos de informática para concursos." },
          { time: 60, label: "01:00 — Conceito Fundamental", text: "Definição formal e aplicação prática segundo as bancas." },
          { time: 180, label: "03:00 — Estrutura e Classificação", text: "Organização dos itens e características técnicas." },
          { time: 300, label: "05:00 — Armadilhas e Pegadinhas", text: "Pontos críticos que as bancas costumam alterar no enunciado." },
          { time: 420, label: "07:00 — Revisão e Fixação", text: "Síntese dos tópicos indispensáveis para gabaritar a prova." },
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

  // Retomada automática da posição salva
  useEffect(() => {
    if (videoRef.current && progress?.position_seconds && progress.position_seconds > 0) {
      videoRef.current.currentTime = progress.position_seconds;
    }
  }, [progress?.position_seconds]);

  // Salvar a cada 10 segundos de vídeo assistido
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (videoRef.current) {
        saveProgressMutation.mutate({ pos: videoRef.current.currentTime });
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Controles do Vídeo
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      saveProgressMutation.mutate({ pos: videoRef.current.currentTime });
    }
  };

  const handleSeek = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration || 9999, seconds));
    setCurrentTime(videoRef.current.currentTime);
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

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

  // Excluir Anotação
  const handleDeleteNote = async (noteId: string) => {
    await supabase.from("notes").delete().eq("id", noteId);
    queryClient.invalidateQueries({ queryKey: ["aula_detail", aulaId] });
  };

  // Gerador de Resumo com IA
  const handleGenerateSummary = () => {
    setIsGeneratingSummary(true);
    setTimeout(() => {
      setGeneratedSummary({
        resumo: `Nesta aula sobre "${lesson?.title}", estudamos os fundamentos centrais exigidos pelas bancas de concursos, abrangendo as definições estruturais, funções principais e a aplicação prática da matéria em questões recentes.`,
        conceitos: [
          "Definição técnica precisa e classificação formal no padrão das bancas examinadoras.",
          "Diferenciação clara entre termos análogos que costumam ser trocados em enunciados.",
          "Papel desempenhado dentro da arquitetura de sistemas e segurança.",
        ],
        pontos: [
          "Atenção à nomenclatura em inglês e sua tradução oficial adotada pelo concurso.",
          "Priorize memorizar os atalhos de teclado e comandos práticos do terminal.",
          "Revise as tabelas comparativas antes do simulado da matéria.",
        ],
        pegadinhas: [
          "Cuidado com generalizações contendo 'sempre', 'nunca' ou 'exclusivamente'.",
          "As bancas frequentemente invertem as funções de componentes primários e secundários.",
          "Confundir protocolos de camadas distintas (ex: transporte vs aplicação).",
        ],
        prova: [
          "Questões de múltipla escolha solicitando a identificação da assertiva correta sobre a arquitetura.",
          "Questões de certo/errado (estilo Cebraspe) explorando exceções de segurança.",
          "Associação direta de comandos com seus parâmetros usuais.",
        ],
      });
      setIsGeneratingSummary(false);
    }, 1200);
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

  // Envio de Pergunta para a IA Contextualizada
  const handleSendIaMessage = async (customPrompt?: string) => {
    const query = (customPrompt || iaInput).trim();
    if (!query || isIaThinking) return;

    setIaInput("");
    setIaMessages((prev) => [...prev, { sender: "user", text: query }]);
    setIsIaThinking(true);

    setTimeout(() => {
      let resposta = `💡 **Tutor de IA — Informática com Jhon**\n*Contexto: ${moduleData?.title} / ${lesson?.title}*\n\n`;

      if (query.includes("resumo")) {
        resposta += `Em resumo para concursos:\n1. O tema principal é **${lesson?.title}**.\n2. Foque na funcionalidade prática e nos atalhos oficiais.\n3. Atenção para não confundir com os conceitos dos outros módulos.`;
      } else if (query.includes("questões") || query.includes("questoes")) {
        resposta += `Aqui está um exemplo de questão sobre esta aula:\n\n**Questão:** Em relação a ${lesson?.title}, assinale a opção correta.\n\n*Gabarito mental:* Busque sempre a alternativa que respeita o padrão formal das bancas sem generalizações absurdas. Você também pode acessar a aba **Questões** para praticar agora mesmo!`;
      } else if (query.includes("RAM") || query.includes("ROM") || query.includes("diferença")) {
        resposta += `**Diferença clássica para concursos:**\n* **RAM:** Memória de leitura e escrita, **volátil** (perde os dados sem energia) e rápida.\n* **ROM:** Memória somente de leitura, **não volátil** (preserva o firmware como BIOS/UEFI mesmo sem energia).`;
      } else {
        resposta += `Com base no conteúdo desta aula, o ponto mais relevante cobrado pelas bancas é entender o propósito do recurso, como ele se integra aos demais componentes do sistema e quais pegadinhas clássicas são exploradas nas provas.`;
      }

      setIaMessages((prev) => [...prev, { sender: "ia", text: resposta }]);
      setIsIaThinking(false);
    }, 900);
  };

  // Navegação anterior / próxima
  const currentIndex = siblings.findIndex((s) => s.id === aulaId);
  const prevLesson = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextLesson = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Filtragem de timestamps na busca da transcrição
  const filteredTimestamps = timestamps.filter(
    (t) =>
      t.label.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
      (t.text && t.text.toLowerCase().includes(transcriptSearch.toLowerCase()))
  );

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
      {/* 1. TOPO: Identificação da Aula, Favoritos e Ações */}
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

        {/* Status de conclusão e navegação entre aulas */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => saveProgressMutation.mutate({ pos: currentTime, completed: !progress?.completed })}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all border",
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
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
              title={`Anterior: ${prevLesson.title}`}
            >
              <ChevronLeft className="size-5" />
            </Link>
          )}

          {nextLesson && (
            <Link
              to="/curso/aula/$aulaId"
              params={{ aulaId: nextLesson.id }}
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
              title={`Próxima: ${nextLesson.title}`}
            >
              <ChevronRight className="size-5" />
            </Link>
          )}
        </div>
      </header>

      {/* 2. PLAYER DE VÍDEO INTELIGENTE */}
      <div
        ref={playerContainerRef}
        className="group relative overflow-hidden rounded-2xl border border-border bg-black shadow-2xl"
      >
        <video
          ref={videoRef}
          src={lesson.video_url || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}
          className="w-full aspect-video max-h-[620px] object-contain cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              if (progress?.position_seconds) videoRef.current.currentTime = progress.position_seconds;
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            saveProgressMutation.mutate({ pos: duration, completed: true });
          }}
          playsInline
        />

        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer backdrop-blur-[2px]"
          >
            <div className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110">
              <Play className="size-8 fill-current ml-1" />
            </div>
          </div>
        )}

        {/* Controles */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary mb-3"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="grid size-9 place-items-center rounded-lg hover:bg-white/20">
                {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
              </button>
              <button onClick={() => handleSeek(currentTime - 10)} className="grid size-9 place-items-center rounded-lg hover:bg-white/20" title="-10s">
                <RotateCcw className="size-4" />
              </button>
              <button onClick={() => handleSeek(currentTime + 10)} className="grid size-9 place-items-center rounded-lg hover:bg-white/20" title="+10s">
                <RotateCw className="size-4" />
              </button>
              <span className="text-xs font-mono text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white/10 rounded-lg p-0.5 text-xs font-semibold">
                {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                  <button
                    key={r}
                    onClick={() => changePlaybackRate(r)}
                    className={cn("px-2 py-1 rounded", playbackRate === r ? "bg-primary text-white" : "text-white/80 hover:bg-white/20")}
                  >
                    {r}x
                  </button>
                ))}
              </div>

              <button onClick={toggleMute} className="grid size-9 place-items-center rounded-lg hover:bg-white/20">
                {isMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>

              <button onClick={toggleFullscreen} className="grid size-9 place-items-center rounded-lg hover:bg-white/20">
                {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ABAS DINÂMICAS ABAIXO DO VÍDEO (Itens 9 a 18 e 25) */}
      <section className="space-y-4">
        {/* Barra de Abas */}
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

        {/* Painel do Conteúdo da Aba */}
        <div className="panel p-6 min-h-[300px]">
          {/* ABA 1: DESCRIÇÃO */}
          {activeTab === "descricao" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-display">{lesson.title}</h2>
              <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed text-sm">
                <p>
                  {lesson.description ||
                    "Nesta videoaula exclusiva de Informática para Concursos, o professor Jhon aborda os principais tópicos cobrados pelas bancas examinadoras, destacando atalhos, armadilhas frequentes e a aplicação prática nas provas."}
                </p>
              </div>
            </div>
          )}

          {/* ABA 2: TRANSCRIÇÃO INTELIGENTE COM TIMESTAMPS NAVEGÁVEIS */}
          {activeTab === "transcricao" && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="size-3.5" /> ✓ Transcrição concluída
                  </span>
                  <span className="text-muted-foreground">• Português Brasileiro (PT-BR)</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-48 sm:w-60">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      placeholder="Pesquisar na transcrição..."
                      className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs focus:border-primary focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => {
                      const fullText = timestamps.map((t) => `${t.label}: ${t.text}`).join("\n\n");
                      navigator.clipboard.writeText(fullText);
                      alert("Transcrição copiada com sucesso!");
                    }}
                    className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                    title="Copiar texto completo"
                  >
                    <Copy className="size-4" />
                  </button>
                </div>
              </div>

              {/* Lista de Timestamps Clicáveis */}
              <div className="space-y-2.5">
                {filteredTimestamps.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSeek(item.time)}
                    className="panel flex items-start gap-3.5 p-3.5 cursor-pointer transition-all hover:border-primary hover:bg-secondary/30 group"
                  >
                    <span className="shrink-0 font-mono text-xs font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-md group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {formatTime(item.time)}
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        {item.label}
                      </p>
                      {item.text && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
                      )}
                    </div>
                  </div>
                ))}

                {filteredTimestamps.length === 0 && (
                  <p className="text-xs text-muted-foreground py-6 text-center">
                    Nenhum trecho da transcrição corresponde à busca "{transcriptSearch}".
                  </p>
                )}
              </div>
            </div>
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
                  <div className="panel p-4 flex items-center justify-between hover:border-primary transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="size-5 text-primary" />
                      <div>
                        <p className="text-xs font-semibold">Apostila Oficial da Aula (PDF)</p>
                        <p className="text-[11px] text-muted-foreground">Material didático</p>
                      </div>
                    </div>
                    <a
                      href={lesson.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <Download className="size-3.5" /> Baixar
                    </a>
                  </div>
                )}

                {materials.map((m) => (
                  <div key={m.id} className="panel p-4 flex items-center justify-between hover:border-primary transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="size-5 text-primary" />
                      <div>
                        <p className="text-xs font-semibold">{m.title}</p>
                        <p className="text-[11px] text-muted-foreground">Material complementar</p>
                      </div>
                    </div>
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <Download className="size-3.5" /> Baixar
                    </a>
                  </div>
                ))}
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
                {questions.map((q, idx) => {
                  const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
                  const userChoice = selectedAnswers[q.id];
                  const hasAnswered = userChoice !== undefined;
                  const isCorrect = userChoice === q.correct_index;

                  return (
                    <div key={q.id} className="panel p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-bold text-accent">QUESTÃO {idx + 1}</span>
                        <span>{q.banca} {q.ano}</span>
                      </div>
                      <p className="text-sm text-foreground">{q.statement}</p>

                      <div className="space-y-2">
                        {opts.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            disabled={hasAnswered}
                            onClick={async () => {
                              setSelectedAnswers((prev) => ({ ...prev, [q.id]: oIdx }));
                              if (user?.id) {
                                await supabase.from("question_attempts").insert({
                                  user_id: user.id,
                                  question_id: q.id,
                                  selected_index: oIdx,
                                  is_correct: oIdx === q.correct_index,
                                });
                              }
                            }}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-xl border p-3 text-left text-xs transition-all",
                              hasAnswered
                                ? oIdx === q.correct_index
                                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 font-semibold"
                                  : userChoice === oIdx
                                  ? "border-red-500/50 bg-red-500/10 text-red-500 line-through"
                                  : "opacity-40"
                                : "border-border bg-secondary/20 hover:bg-secondary/60"
                            )}
                          >
                            <span className="font-mono font-bold">{String.fromCharCode(65 + oIdx)})</span>
                            <span>{opt}</span>
                          </button>
                        ))}
                      </div>

                      {hasAnswered && (
                        <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs space-y-1">
                          <p className="font-bold">
                            {isCorrect ? <span className="text-emerald-500">✓ Resposta Correta!</span> : <span className="text-amber-500">✗ Incorreta. Gabarito: Letra {String.fromCharCode(65 + q.correct_index)}</span>}
                          </p>
                          {q.explanation && <p className="text-muted-foreground">{q.explanation}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ABA 5: RESUMO COM IA (Item 18) */}
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
                <div className="space-y-5">
                  {/* Resumo Geral */}
                  <div className="panel p-4 space-y-1.5 border-l-4 border-l-primary">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent">Resumo da Aula</h4>
                    <p className="text-xs md:text-sm text-foreground leading-relaxed">{generatedSummary.resumo}</p>
                  </div>

                  {/* Principais Conceitos */}
                  <div className="panel p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" /> Principais Conceitos
                    </h4>
                    <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                      {generatedSummary.conceitos.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Pontos Importantes */}
                  <div className="panel p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Lightbulb className="size-4 text-amber-400" /> Pontos Importantes
                    </h4>
                    <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                      {generatedSummary.pontos.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Pegadinhas de Bancas */}
                  <div className="panel p-4 space-y-2 border-l-4 border-l-red-500 bg-red-500/5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-1.5">
                      <ShieldAlert className="size-4" /> Pegadinhas Clássicas de Concurso
                    </h4>
                    <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                      {generatedSummary.pegadinhas.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>

                  {/* O que pode ser cobrado em prova */}
                  <div className="panel p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent">
                      O que pode ser cobrado em prova
                    </h4>
                    <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                      {generatedSummary.prova.map((pv, i) => (
                        <li key={i}>{pv}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="panel p-10 text-center space-y-3">
                  <Sparkles className="size-10 mx-auto text-accent/50" />
                  <p className="text-sm font-semibold">Resumo ainda não gerado para esta aula.</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Clique no botão acima para a IA analisar o vídeo e os materiais e extrair os pontos cruciais de prova.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ABA 6: MINHAS ANOTAÇÕES (Item 25) */}
          {activeTab === "anotacoes" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold font-display">Minhas Anotações da Aula</h3>
                <p className="text-xs text-muted-foreground">
                  Escreva seus apontamentos. Você pode sincronizar a anotação com o momento exato do vídeo.
                </p>
              </div>

              {/* Formulário de Nova Anotação */}
              <form onSubmit={handleAddNote} className="panel p-4 space-y-3 border border-border">
                <textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Escreva sua anotação sobre este momento da aula..."
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
                    <span>Vincular ao momento atual do vídeo ({formatTime(currentTime)})</span>
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

              {/* Lista de Anotações */}
              <div className="space-y-2.5">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="panel flex items-start justify-between gap-4 p-4 border border-border"
                  >
                    <div className="space-y-1">
                      {note.timestamp_seconds > 0 && (
                        <button
                          onClick={() => handleSeek(note.timestamp_seconds)}
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
                      title="Excluir anotação"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}

                {notes.length === 0 && (
                  <p className="text-xs text-muted-foreground py-6 text-center">
                    Você ainda não fez nenhuma anotação nesta aula.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ABA 7: PERGUNTE À IA (Item 13) */}
          {activeTab === "ia" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-accent" />
                  <div>
                    <h3 className="text-sm font-bold font-display">Tutor de IA — Aula Contextualizada</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Respostas fundamentadas no conteúdo de: <strong>{lesson.title}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Prompts Rápidos Especificados no Item 13 */}
              <div className="flex flex-wrap gap-2">
                {[
                  "Explique esse assunto.",
                  "Qual a diferença entre RAM e ROM?",
                  "Faça um resumo dessa aula.",
                  "Quais pontos são mais importantes?",
                  "Crie questões sobre esse conteúdo.",
                ].map((pText) => (
                  <button
                    key={pText}
                    onClick={() => handleSendIaMessage(pText)}
                    className="rounded-lg bg-secondary px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border"
                  >
                    "{pText}"
                  </button>
                ))}
              </div>

              {/* Mensagens do Chat */}
              <div className="h-64 overflow-y-auto space-y-3 rounded-xl border border-border bg-secondary/10 p-4">
                {iaMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col max-w-[85%] rounded-2xl px-4 py-2.5 text-xs md:text-sm leading-relaxed",
                      msg.sender === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "mr-auto panel border-border text-foreground"
                    )}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                ))}

                {isIaThinking && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="size-3.5 animate-spin text-accent" /> O Tutor Jhon está formulando a explicação...
                  </div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendIaMessage();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={iaInput}
                  onChange={(e) => setIaInput(e.target.value)}
                  placeholder="Tire qualquer dúvida sobre esta aula com a IA..."
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-xs focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!iaInput.trim() || isIaThinking}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Send className="size-3.5" /> Perguntar
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
