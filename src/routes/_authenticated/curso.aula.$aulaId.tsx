import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  HelpCircle,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Send,
  Sparkles,
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
      { name: "description", content: "Assista a videoaula, veja o material e tire dúvidas com IA." },
    ],
  }),
  component: AulaDetailPage,
});

type ActiveTab = "descricao" | "transcricao" | "pdf" | "questoes" | "ia";

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

  // Estados da IA
  const [iaMessages, setIaMessages] = useState<Array<{ sender: "user" | "ia"; text: string }>>([]);
  const [iaInput, setIaInput] = useState("");
  const [isIaThinking, setIsIaThinking] = useState(false);

  // Estados de Questões
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["aula", aulaId, user?.id],
    enabled: Boolean(aulaId && user?.id),
    queryFn: async () => {
      const [lessonRes, progressRes, materialsRes] = await Promise.all([
        supabase.from("lessons").select("*, modules(*)").eq("id", aulaId).maybeSingle(),
        supabase.from("lesson_progress").select("*").eq("lesson_id", aulaId).maybeSingle(),
        supabase.from("materials").select("*").eq("lesson_id", aulaId),
      ]);

      const lesson = lessonRes.data;
      if (!lesson) return null;

      // Buscar aulas irmãs do mesmo módulo para navegação anterior/próxima
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

      // Buscar tentativas do aluno nessas questões
      const attemptsRes = await supabase
        .from("question_attempts")
        .select("question_id, selected_index, is_correct")
        .eq("user_id", user?.id || "");

      return {
        lesson,
        module: lesson.modules,
        siblings: siblingsRes.data ?? [],
        progress: progressRes.data,
        materials: materialsRes.data ?? [],
        questions: questionsRes.data ?? [],
        attempts: attemptsRes.data ?? [],
      };
    },
  });

  const lesson = data?.lesson;
  const moduleData = data?.module;
  const siblings = data?.siblings ?? [];
  const progress = data?.progress;
  const questions = data?.questions ?? [];
  const materials = data?.materials ?? [];

  // Salvar progresso
  const saveProgressMutation = useMutation({
    mutationFn: async ({ pos, completed }: { pos: number; completed?: boolean }) => {
      if (!user?.id || !aulaId) return;
      const payload: {
        user_id: string;
        lesson_id: string;
        position_seconds: number;
        completed?: boolean;
        updated_at: string;
      } = {
        user_id: user.id,
        lesson_id: aulaId,
        position_seconds: Math.floor(pos),
        updated_at: new Date().toISOString(),
      };
      if (completed !== undefined) {
        payload.completed = completed;
      }

      await supabase.from("lesson_progress").upsert(payload, { onConflict: "user_id,lesson_id" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aula", aulaId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // Retomar posição salva
  useEffect(() => {
    if (videoRef.current && progress?.position_seconds && progress.position_seconds > 0) {
      videoRef.current.currentTime = progress.position_seconds;
    }
  }, [progress?.position_seconds]);

  // Salvar progresso a cada intervalo durante a reprodução
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (videoRef.current) {
        saveProgressMutation.mutate({
          pos: videoRef.current.currentTime,
        });
      }
    }, 10000); // a cada 10s
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Controles de vídeo
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

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    if (progress?.position_seconds && progress.position_seconds > 0) {
      videoRef.current.currentTime = progress.position_seconds;
    }
  };

  const handleSeek = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, seconds));
    setCurrentTime(videoRef.current.currentTime);
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

  const handleVolumeChange = (v: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = v;
    setVolume(v);
    setIsMuted(v === 0);
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

  const handleVideoEnded = () => {
    setIsPlaying(false);
    saveProgressMutation.mutate({
      pos: duration,
      completed: true,
    });
  };

  const toggleCompletedManual = () => {
    const nextStatus = !progress?.completed;
    saveProgressMutation.mutate({
      pos: currentTime,
      completed: nextStatus,
    });
  };

  // Navegação para aula anterior / seguinte
  const currentIndex = siblings.findIndex((s) => s.id === aulaId);
  const prevLesson = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextLesson = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  // Envio de pergunta para a IA
  const handleSendIaMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iaInput.trim() || isIaThinking) return;

    const userMsg = iaInput.trim();
    setIaInput("");
    setIaMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setIsIaThinking(true);

    // Resposta contextualizada baseada na matéria da aula
    setTimeout(() => {
      let resposta = `Olá! Com base no conteúdo da aula "${lesson?.title}", aqui está a explicação para concursos:\n\n`;
      if (userMsg.toLowerCase().includes("banca") || userMsg.toLowerCase().includes("fgv") || userMsg.toLowerCase().includes("cebraspe")) {
        resposta += `Nas bancas como FGV e Cebraspe, esse assunto é frequentemente cobrado com foco em pegadinhas sobre detalhes práticos e exceções conceituais. Fique atento às definições exatas e atalhos!`;
      } else {
        resposta += `Em questões de informática, é essencial lembrar o conceito central deste tópico: foque na funcionalidade principal, nas classificações e nos termos técnicos que as bancas costumam trocar entre si para confundir o candidato.`;
      }

      setIaMessages((prev) => [...prev, { sender: "ia", text: resposta }]);
      setIsIaThinking(false);
    }, 1000);
  };

  // Submissão de resposta de questão
  const handleAnswerQuestion = async (qId: string, optionIndex: number, correctIndex: number) => {
    if (!user?.id) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optionIndex }));
    setShowExplanation((prev) => ({ ...prev, [qId]: true }));

    const isCorrect = optionIndex === correctIndex;
    await supabase.from("question_attempts").insert({
      user_id: user.id,
      question_id: qId,
      selected_index: optionIndex,
      is_correct: isCorrect,
    });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

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
          <ArrowLeft className="size-4" /> Voltar para o curso
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. TOPO: Navegação, Módulo, Título e Status */}
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
          <h1 className="text-2xl font-bold md:text-3xl font-display">{lesson.title}</h1>
        </div>

        {/* Ações e Navegação Anterior / Próxima */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={toggleCompletedManual}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
              progress?.completed
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20"
                : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
            )}
          >
            <CheckCircle2 className="size-4" />
            {progress?.completed ? "Concluída" : "Marcar como concluída"}
          </button>

          {prevLesson && (
            <Link
              to="/curso/aula/$aulaId"
              params={{ aulaId: prevLesson.id }}
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-secondary/50 text-foreground transition-colors hover:bg-secondary"
              title={`Anterior: ${prevLesson.title}`}
            >
              <ChevronLeft className="size-5" />
            </Link>
          )}

          {nextLesson && (
            <Link
              to="/curso/aula/$aulaId"
              params={{ aulaId: nextLesson.id }}
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-secondary/50 text-foreground transition-colors hover:bg-secondary"
              title={`Próxima: ${nextLesson.title}`}
            >
              <ChevronRight className="size-5" />
            </Link>
          )}
        </div>
      </header>

      {/* 2. CENTRO: Player de Vídeo Profissional */}
      <div
        ref={playerContainerRef}
        className="group relative overflow-hidden rounded-2xl border border-border bg-black shadow-2xl"
      >
        <video
          ref={videoRef}
          src={lesson.video_url || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}
          className="w-full aspect-video max-h-[620px] object-contain cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleVideoEnded}
          playsInline
        />

        {/* Botão Central de Play/Pause ao passar o mouse ou pausado */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer backdrop-blur-[2px] transition-all"
          >
            <div className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110">
              <Play className="size-8 fill-current ml-1" />
            </div>
          </div>
        )}

        {/* Barra de Controles Inferior */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-opacity duration-300">
          {/* Linha do Tempo (Seekbar) */}
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary hover:h-2 transition-all mb-3"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-white">
            {/* Lado Esquerdo: Play/Pause, -10s, +10s, Tempo */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
                aria-label={isPlaying ? "Pausar" : "Reproduzir"}
              >
                {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
              </button>

              <button
                onClick={() => handleSeek(currentTime - 10)}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
                title="Retroceder 10s"
              >
                <RotateCcw className="size-4" />
              </button>

              <button
                onClick={() => handleSeek(currentTime + 10)}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
                title="Avançar 10s"
              >
                <RotateCw className="size-4" />
              </button>

              <span className="text-xs font-mono text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Lado Direito: Velocidade, Volume, Tela Cheia */}
            <div className="flex items-center gap-3">
              {/* Seletor de Velocidade */}
              <div className="flex items-center bg-white/10 rounded-lg p-0.5 text-xs font-semibold">
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    className={cn(
                      "px-2 py-1 rounded transition-colors",
                      playbackRate === rate ? "bg-primary text-primary-foreground" : "hover:bg-white/20 text-white/80"
                    )}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {/* Volume */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleMute}
                  className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Silenciar"
                >
                  {isMuted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-16 h-1 bg-white/30 rounded appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Tela Cheia */}
              <button
                onClick={toggleFullscreen}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Tela cheia"
              >
                {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ABAIXO DO VÍDEO: [ DESCRIÇÃO ] [ TRANSCRIÇÃO ] [ PDF ] [ QUESTÕES ] [ IA ] */}
      <section className="space-y-4">
        {/* Navegação das Abas */}
        <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
          {[
            { id: "descricao", label: "DESCRIÇÃO", icon: FileText },
            { id: "transcricao", label: "TRANSCRIÇÃO", icon: FileText },
            { id: "pdf", label: "PDF & MATERIAIS", icon: Download },
            { id: "questoes", label: "QUESTÕES", icon: HelpCircle, count: questions.length },
            { id: "ia", label: "TUTOR DE IA", icon: Sparkles },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold tracking-wide transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <tab.icon className="size-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                    activeTab === tab.id ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Conteúdo da Aba Selecionada */}
        <div className="panel p-6 min-h-[260px]">
          {/* ABA: DESCRIÇÃO */}
          {activeTab === "descricao" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-display">{lesson.title}</h2>
              <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed">
                {lesson.description ? (
                  <p>{lesson.description}</p>
                ) : (
                  <p>
                    Nesta videoaula exclusiva de <strong>Informática para Concursos</strong>, o professor Jhon aborda os
                    principais tópicos cobrados pelas bancas examinadoras, destacando atalhos, armadilhas frequentes e a
                    aplicação prática nas provas.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ABA: TRANSCRIÇÃO */}
          {activeTab === "transcricao" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold font-display">Transcrição da Aula</h3>
                {lesson.transcript && (
                  <button
                    onClick={() => navigator.clipboard.writeText(lesson.transcript)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Copiar texto completo
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto rounded-xl bg-secondary/30 p-4 font-mono text-sm leading-relaxed text-muted-foreground">
                {lesson.transcript || (
                  <p className="italic text-muted-foreground">
                    A transcrição completa desta aula estará disponível em breve para leitura e pesquisa textual.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ABA: PDF */}
          {activeTab === "pdf" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold font-display">Materiais e Apostilas em PDF</h3>
              <p className="text-sm text-muted-foreground">
                Baixe o material de apoio em PDF para acompanhar a aula e revisar os pontos-chave da disciplina.
              </p>

              <div className="grid gap-3 sm:grid-cols-2 mt-4">
                {lesson.pdf_url && (
                  <a
                    href={lesson.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="panel flex items-center justify-between p-4 transition-colors hover:border-primary group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <FileText className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Apostila da Aula (PDF)</p>
                        <p className="text-xs text-muted-foreground">Material oficial</p>
                      </div>
                    </div>
                    <Download className="size-4 text-muted-foreground group-hover:text-primary" />
                  </a>
                )}

                {materials.map((mat) => (
                  <a
                    key={mat.id}
                    href={mat.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="panel flex items-center justify-between p-4 transition-colors hover:border-primary group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <FileText className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{mat.title}</p>
                        <p className="text-xs text-muted-foreground">Material complementar</p>
                      </div>
                    </div>
                    <Download className="size-4 text-muted-foreground group-hover:text-primary" />
                  </a>
                ))}

                {!lesson.pdf_url && materials.length === 0 && (
                  <div className="col-span-2 text-center py-6 text-sm text-muted-foreground">
                    Nenhum arquivo PDF anexado para esta aula no momento.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA: QUESTÕES */}
          {activeTab === "questoes" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold font-display">Fixação com Questões de Concursos</h3>
                <p className="text-sm text-muted-foreground">
                  Resolva as questões sobre este assunto para avaliar sua absorção antes de prosseguir.
                </p>
              </div>

              <div className="space-y-6">
                {questions.map((q, qIndex) => {
                  const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
                  const userSelectedIndex = selectedAnswers[q.id];
                  const hasAnswered = userSelectedIndex !== undefined;
                  const isCorrect = userSelectedIndex === q.correct_index;

                  return (
                    <div key={q.id} className="panel p-5 space-y-4 border border-border">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-accent">QUESTÃO {qIndex + 1}</span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {q.banca && <span className="rounded bg-secondary px-2 py-0.5 font-semibold">{q.banca}</span>}
                          {q.ano && <span>{q.ano}</span>}
                        </div>
                      </div>

                      <p className="text-foreground text-sm md:text-base leading-relaxed">{q.statement}</p>

                      {/* Opções de Resposta */}
                      <div className="space-y-2">
                        {opts.map((opt, optIndex) => {
                          const isSelected = userSelectedIndex === optIndex;
                          const isThisCorrect = optIndex === q.correct_index;

                          let btnStyle = "border-border bg-secondary/30 hover:bg-secondary/70";
                          if (hasAnswered) {
                            if (isThisCorrect) {
                              btnStyle = "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 font-semibold";
                            } else if (isSelected) {
                              btnStyle = "border-red-500/50 bg-red-500/10 text-red-500 line-through";
                            } else {
                              btnStyle = "opacity-60 border-border";
                            }
                          }

                          return (
                            <button
                              key={optIndex}
                              disabled={hasAnswered}
                              onClick={() => handleAnswerQuestion(q.id, optIndex, q.correct_index)}
                              className={cn(
                                "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-all",
                                btnStyle
                              )}
                            >
                              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary font-mono text-xs font-bold">
                                {String.fromCharCode(65 + optIndex)}
                              </span>
                              <span className="flex-1">{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Comentário e Gabarito do Professor */}
                      {hasAnswered && (
                        <div
                          className={cn(
                            "rounded-xl p-4 text-sm leading-relaxed border space-y-1.5",
                            isCorrect
                              ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                              : "border-amber-500/30 bg-amber-500/5 text-foreground"
                          )}
                        >
                          <p className="font-bold flex items-center gap-1.5">
                            {isCorrect ? (
                              <span className="text-emerald-500 flex items-center gap-1">
                                <CheckCircle2 className="size-4" /> Parabéns! Você acertou.
                              </span>
                            ) : (
                              <span className="text-amber-500">Resposta incorreta. Gabarito: Letra {String.fromCharCode(65 + q.correct_index)}</span>
                            )}
                          </p>
                          {q.explanation && (
                            <p className="text-muted-foreground text-xs md:text-sm">
                              <strong>Comentário do Professor:</strong> {q.explanation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {questions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhuma questão cadastrada diretamente para esta aula. Acesse a aba Questões no menu para praticar simulados completos!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA: IA */}
          {activeTab === "ia" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-accent" />
                <div>
                  <h3 className="text-lg font-semibold font-display">Tutor de IA — Informática com Jhon</h3>
                  <p className="text-xs text-muted-foreground">
                    Tire dúvidas em tempo real sobre os conceitos abordados nesta aula.
                  </p>
                </div>
              </div>

              {/* Histórico do Chat */}
              <div className="h-64 overflow-y-auto space-y-3 rounded-xl border border-border bg-secondary/20 p-4">
                {iaMessages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground text-sm space-y-2">
                    <Sparkles className="size-8 text-accent/50" />
                    <p>Qual a sua dúvida sobre <strong>{lesson.title}</strong>?</p>
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      <button
                        onClick={() => setIaInput("Quais são as pegadinhas mais comuns de concurso sobre essa aula?")}
                        className="rounded-lg bg-secondary px-3 py-1.5 text-xs hover:text-foreground transition-colors"
                      >
                        "Pegadinhas comuns de concurso"
                      </button>
                      <button
                        onClick={() => setIaInput("Resuma os conceitos principais desta aula em tópicos.")}
                        className="rounded-lg bg-secondary px-3 py-1.5 text-xs hover:text-foreground transition-colors"
                      >
                        "Resumo em tópicos"
                      </button>
                    </div>
                  </div>
                )}

                {iaMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.sender === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "mr-auto bg-secondary border border-border text-foreground"
                    )}
                  >
                    <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                  </div>
                ))}

                {isIaThinking && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="size-3.5 animate-spin text-accent" /> O Tutor Jhon está digitando a explicação...
                  </div>
                )}
              </div>

              {/* Input de Mensagem */}
              <form onSubmit={handleSendIaMessage} className="flex gap-2">
                <input
                  type="text"
                  value={iaInput}
                  onChange={(e) => setIaInput(e.target.value)}
                  placeholder="Pergunte ao tutor de IA sobre esta aula..."
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!iaInput.trim() || isIaThinking}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Send className="size-4" /> Enviar
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
