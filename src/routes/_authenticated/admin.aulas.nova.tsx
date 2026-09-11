import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Sparkles, Video, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UploadArea } from "@/components/UploadArea";
import { ProcessingStatus, type ProcessingStep } from "@/components/ProcessingStatus";
import { aiService } from "@/lib/ai/ai-service";

export const Route = createFileRoute("/_authenticated/admin/aulas/nova")({
  head: () => ({
    meta: [
      { title: "Publicar Nova Aula — Painel do Professor" },
      { name: "description", content: "Upload de videoaula e processamento automático com IA." },
    ],
  }),
  component: NovaAulaPage,
});

function NovaAulaPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Estados do formulário
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Arquivos
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");

  // Automações de IA (Item 32)
  const [autoProcessWithAi, setAutoProcessWithAi] = useState(true);
  const [questionsQty, setQuestionsQty] = useState(10);

  // Estados de Processamento (Item 29)
  const [step, setStep] = useState<ProcessingStep>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Buscar cursos da plataforma
  const { data: courses = [] } = useQuery({
    queryKey: ["admin_courses_select"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await supabase.from("courses").select("id, title, category").order("position");
      const list = res.data ?? [];
      if (list.length > 0 && !selectedCourseId) {
        setSelectedCourseId(list[0].id);
      }
      return list;
    },
  });

  // Buscar módulos do curso selecionado
  const { data: modules = [] } = useQuery({
    queryKey: ["admin_modules_select", selectedCourseId],
    enabled: isAdmin && Boolean(selectedCourseId),
    queryFn: async () => {
      const res = await supabase
        .from("modules")
        .select("id, title, position, course_id")
        .eq("course_id", selectedCourseId)
        .order("position");
      return res.data ?? [];
    },
  });

  const handleStartProcessing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleId) {
      alert("Por favor, selecione um módulo.");
      return;
    }
    if (!title.trim()) {
      alert("O título da aula é obrigatório.");
      return;
    }

    setErrorMessage(null);

    try {
      let finalVideoUrl = videoUrl.trim();
      let finalPdfUrl = pdfUrl.trim();

      // 1. Processando Vídeo (Item 29)
      if (videoFile) {
        setStep("processing_video");
        setProgress(20);

        const videoExt = videoFile.name.split(".").pop();
        const videoPath = `${moduleId}/${Date.now()}_video.${videoExt}`;

        await supabase.storage.from("videoaulas").upload(videoPath, videoFile, {
          cacheControl: "3600",
          upsert: false,
        });

        const { data: vPublic } = supabase.storage.from("videoaulas").getPublicUrl(videoPath);
        finalVideoUrl = vPublic?.publicUrl || "";
      }

      // 2. Processando PDF (Item 29)
      if (pdfFile) {
        setStep("processing_pdf");
        setProgress(40);

        const pdfExt = pdfFile.name.split(".").pop();
        const pdfPath = `apostilas/${Date.now()}_${pdfFile.name}`;

        await supabase.storage.from("materiais").upload(pdfPath, pdfFile, { upsert: false });
        const { data: pPublic } = supabase.storage.from("materiais").getPublicUrl(pdfPath);
        finalPdfUrl = pPublic?.publicUrl || "";
      }

      // Posição no módulo
      const { data: currentLessons } = await supabase
        .from("lessons")
        .select("position")
        .eq("module_id", moduleId);

      const nextPosition =
        currentLessons && currentLessons.length > 0
          ? Math.max(...currentLessons.map((l) => l.position)) + 1
          : 1;

      // 3. Gerando Transcrição (Item 29)
      let transcriptionData = { transcript: "", timestamps: [] as any[] };
      if (autoProcessWithAi) {
        setStep("generating_transcript");
        setProgress(55);
        transcriptionData = await aiService.transcribeVideo(finalVideoUrl, title);
      }

      // 4. Inserir Aula no Banco de Dados
      const { data: newLesson, error: lessonError } = await supabase
        .from("lessons")
        .insert({
          module_id: moduleId,
          title: title.trim(),
          description: description.trim(),
          transcript: transcriptionData.transcript,
          transcript_timestamps: transcriptionData.timestamps,
          video_url: finalVideoUrl || null,
          pdf_url: finalPdfUrl || null,
          position: nextPosition,
          published: true,
          transcription_status: "completed",
        })
        .select("id")
        .single();

      if (lessonError) throw lessonError;

      // 5. Gerando Resumo com IA (Item 29)
      if (autoProcessWithAi && newLesson?.id) {
        setStep("generating_summary");
        setProgress(75);

        const summaryData = await aiService.generateSummary({
          lessonTitle: title,
          transcript: transcriptionData.transcript,
        });

        await supabase.from("summaries").insert({
          lesson_id: newLesson.id,
          summary_text: summaryData.resumo,
          key_concepts: summaryData.conceitos,
          important_points: summaryData.pontos,
          exam_traps: summaryData.pegadinhas,
          likely_questions: summaryData.prova,
        });
      }

      // 6. Gerando Questões com IA (Item 29)
      if (autoProcessWithAi && newLesson?.id) {
        setStep("generating_questions");
        setProgress(90);

        const questionsList = await aiService.generateQuestions(
          Math.min(questionsQty, 5),
          "Médio",
          { lessonTitle: title }
        );

        const toInsert = questionsList.map((q) => ({
          course_id: selectedCourseId || null,
          lesson_id: newLesson.id,
          module_id: moduleId,
          statement: q.statement,
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation,
          banca: q.banca,
          ano: 2024,
          difficulty: "medio",
          subject: title,
        }));

        await supabase.from("questions").insert(toInsert);
      }

      // Concluído (Item 29)
      setStep("completed");
      setProgress(100);

      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["curso"] });
      queryClient.invalidateQueries({ queryKey: ["admin_all_lessons"] });

      setTimeout(() => {
        navigate({ to: "/curso/aula/$aulaId", params: { aulaId: newLesson.id } });
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setStep("error");
      setErrorMessage(err?.message || "Não foi possível processar o arquivo. Verifique sua conexão e tente novamente.");
    }
  };

  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center space-y-4 max-w-md mx-auto my-12">
        <h2 className="text-xl font-bold font-display">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground">Esta área é restrita para o professor.</p>
        <Link to="/dashboard" className="inline-block rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  const isBusy = step !== "idle" && step !== "completed" && step !== "error";

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <Link
          to="/admin/aulas"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao gerenciamento de aulas
        </Link>
        <h1 className="mt-2 text-3xl font-bold font-display">Cadastro de Aula em 1 Clique</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie o vídeo e o PDF. O sistema gera automaticamente a transcrição com minutagem, resumo e bateria de questões vinculadas.
        </p>
      </div>

      {/* Exibição Granular do Status de Processamento (Item 29) */}
      <ProcessingStatus
        currentStep={step}
        progressPercent={progress}
        errorMessage={errorMessage || undefined}
        onRetry={() => {
          setStep("idle");
          setErrorMessage(null);
        }}
      />

      <form onSubmit={handleStartProcessing} className="panel p-6 md:p-8 space-y-6">
        {/* Identificação da Aula */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-primary mb-1.5">
              1. Curso da Aula *
            </label>
            <select
              required
              disabled={isBusy}
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setModuleId("");
              }}
              className="w-full rounded-xl border border-primary/40 bg-background px-4 py-2.5 text-xs font-semibold focus:border-primary focus:outline-none"
            >
              <option value="">Selecione o curso...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.category})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              2. Módulo de Destino *
            </label>
            <select
              required
              disabled={isBusy || !selectedCourseId}
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs focus:border-primary focus:outline-none disabled:opacity-50"
            >
              <option value="">Selecione o módulo deste curso...</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  Módulo {m.position} — {m.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Título da Videoaula *
            </label>
            <input
              type="text"
              required
              disabled={isBusy}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Aula 03 — Memória RAM e Tecnologias DDR"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Descrição
            </label>
            <textarea
              rows={2}
              disabled={isBusy}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objetivos e tópicos abordados nesta aula..."
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Upload de Vídeo com Componente UploadArea */}
        <div className="border-t border-border pt-6 space-y-3">
          <UploadArea
            label="Videoaula"
            accept="video/*"
            maxSizeMB={500}
            fileTypeLabel=".mp4, .webm"
            selectedFile={videoFile}
            onFileSelected={setVideoFile}
          />
          {!videoFile && (
            <input
              type="url"
              value={videoUrl}
              disabled={isBusy}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Ou insira um link direto de vídeo (ex: CDN ou Storage)"
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-xs focus:border-primary focus:outline-none"
            />
          )}
        </div>

        {/* Upload de PDF com Componente UploadArea */}
        <div className="border-t border-border pt-6 space-y-3">
          <UploadArea
            label="Apostila em PDF"
            accept=".pdf"
            maxSizeMB={50}
            fileTypeLabel=".pdf"
            selectedFile={pdfFile}
            onFileSelected={setPdfFile}
          />
          {!pdfFile && (
            <input
              type="url"
              value={pdfUrl}
              disabled={isBusy}
              onChange={(e) => setPdfUrl(e.target.value)}
              placeholder="Ou insira um link direto para o PDF da aula"
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-xs focus:border-primary focus:outline-none"
            />
          )}
        </div>

        {/* Experiência do Professor: Checkbox de 1 Clique "Processar com IA" (Item 32) */}
        <div className="border-t border-border pt-6 space-y-3">
          <div className="panel p-4 rounded-xl border border-accent/30 bg-accent/5 space-y-2.5">
            <label className="flex items-center gap-3 text-xs font-bold text-foreground cursor-pointer">
              <input
                type="checkbox"
                disabled={isBusy}
                checked={autoProcessWithAi}
                onChange={(e) => setAutoProcessWithAi(e.target.checked)}
                className="size-4 rounded text-primary"
              />
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-4 text-accent" /> Processar Tudo com IA em 1 Clique
              </span>
            </label>
            <p className="text-[11px] text-muted-foreground leading-relaxed pl-7">
              Ao marcar esta opção, o sistema executará automaticamente: extração de áudio, transcrição com timestamps inteligentes, análise do PDF, resumo estruturado e geração de questões vinculadas à aula.
            </p>

            {autoProcessWithAi && (
              <div className="pl-7 pt-1 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Quantidade de questões automáticas:</span>
                <select
                  value={questionsQty}
                  disabled={isBusy}
                  onChange={(e) => setQuestionsQty(Number(e.target.value))}
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold"
                >
                  <option value={5}>5 questões</option>
                  <option value={10}>10 questões</option>
                  <option value={15}>15 questões</option>
                  <option value={20}>20 questões</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Botão de Envio */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isBusy}
            className="glow-primary flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            <Sparkles className="size-4" />
            {isBusy ? "Processando..." : "Publicar e Processar com IA"}
          </button>
        </div>
      </form>
    </div>
  );
}
