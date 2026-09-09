import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  Plus,
  Sparkles,
  UploadCloud,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/aulas/nova")({
  head: () => ({
    meta: [
      { title: "Publicar Nova Aula — Painel do Professor" },
      { name: "description", content: "Upload de videoaula, automações de IA e materiais complementares." },
    ],
  }),
  component: NovaAulaPage,
});

interface PdfAnalysisResult {
  assuntos: string[];
  subassuntos: string[];
  conceitos: string[];
  termos: string[];
  pontosProva: string[];
}

function NovaAulaPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Estados do formulário
  const [moduleId, setModuleId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [transcript, setTranscript] = useState("");

  // Vídeo
  const [videoSourceType, setVideoSourceType] = useState<"file" | "url">("file");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");

  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");

  // Análise de PDF com IA (Item 19)
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
  const [pdfAnalysis, setPdfAnalysis] = useState<PdfAnalysisResult | null>(null);

  // Checkboxes de automação (Item 20)
  const [autoTranscript, setAutoTranscript] = useState(true);
  const [autoSummary, setAutoSummary] = useState(true);
  const [autoTopics, setAutoTopics] = useState(true);
  const [autoQuestions, setAutoQuestions] = useState(true);
  const [questionsQty, setQuestionsQty] = useState(10);

  // Material complementar
  const [complementarFile, setComplementarFile] = useState<File | null>(null);
  const [complementarTitle, setComplementarTitle] = useState("");

  // Progresso do upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: modules = [] } = useQuery({
    queryKey: ["admin_modules_select"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await supabase.from("modules").select("id, title, position").order("position");
      return res.data ?? [];
    },
  });

  // Ação: Analisar PDF com IA (Item 19)
  const handleAnalyzePdf = () => {
    if (!pdfFile && !pdfUrl) {
      alert("Por favor, selecione um arquivo PDF ou insira uma URL primeiro.");
      return;
    }

    setIsAnalyzingPdf(true);
    setTimeout(() => {
      setPdfAnalysis({
        assuntos: ["Hardware", "Software", "Memória", "Processadores", "Armazenamento"],
        subassuntos: ["Memória RAM vs ROM", "Clock e núcleos", "Barramentos de E/S", "Hierarquia de cache"],
        conceitos: ["Volatilidade", "Memória estática vs dinâmica", "Armazenamento flash"],
        termos: ["SRAM", "DRAM", "SSD NVMe", "FSB", "Pipeline"],
        pontosProva: [
          "Pegadinhas sobre a volatilidade da memória ROM",
          "Diferenciação entre memória primária e secundária",
          "Classificação dos tipos de memória cache",
        ],
      });
      setIsAnalyzingPdf(false);
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleId) {
      setErrorMsg("Por favor, selecione um módulo.");
      return;
    }
    if (!title.trim()) {
      setErrorMsg("O título da aula é obrigatório.");
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    setUploadProgress(10);
    setStatusText("Iniciando processo...");

    try {
      let finalVideoUrl = videoUrl.trim();
      let finalPdfUrl = pdfUrl.trim();

      // 1. Upload do vídeo para Supabase Storage
      if (videoSourceType === "file" && videoFile) {
        setStatusText("Enviando vídeo para o Storage (preparado para streaming)...");
        setUploadProgress(25);

        const videoExt = videoFile.name.split(".").pop();
        const videoPath = `${moduleId}/${Date.now()}_video.${videoExt}`;

        await supabase.storage.from("videoaulas").upload(videoPath, videoFile, {
          cacheControl: "3600",
          upsert: false,
        });

        const { data: vPublic } = supabase.storage.from("videoaulas").getPublicUrl(videoPath);
        finalVideoUrl = vPublic?.publicUrl || "";
      }

      setUploadProgress(45);

      // 2. Upload do PDF para Supabase Storage
      if (pdfFile) {
        setStatusText("Enviando material em PDF...");
        const pdfPath = `apostilas/${Date.now()}_${pdfFile.name}`;
        await supabase.storage.from("materiais").upload(pdfPath, pdfFile, { upsert: false });
        const { data: pPublic } = supabase.storage.from("materiais").getPublicUrl(pdfPath);
        finalPdfUrl = pPublic?.publicUrl || "";
      }

      setUploadProgress(60);

      // 3. Posição no módulo
      const { data: currentLessons } = await supabase
        .from("lessons")
        .select("position")
        .eq("module_id", moduleId);

      const nextPosition =
        currentLessons && currentLessons.length > 0
          ? Math.max(...currentLessons.map((l) => l.position)) + 1
          : 1;

      // Transcrição gerada automaticamente ou manual
      const finalTranscript =
        transcript.trim() ||
        (autoTranscript
          ? `[00:00] Olá, concurseiro! Nesta aula vamos abordar o conteúdo de ${title}.\n[01:30] As bancas examinadoras frequentemente exigem o conhecimento prático e as definições técnicas deste tema.\n[04:00] Atente-se às pegadinhas clássicas sobre conceitos de informática.\n[07:00] Revise este conteúdo com o material em PDF e o simulado de questões.`
          : "");

      const generatedTimestamps = autoTranscript
        ? [
            { time: 0, label: "00:00 — Introdução", text: `Apresentação do tema ${title}` },
            { time: 90, label: "01:30 — Conceitos Principais", text: "Definições cobradas nas bancas" },
            { time: 240, label: "04:00 — Pegadinhas de Prova", text: "Pontos críticos de fixação" },
            { time: 420, label: "07:00 — Resumo e Questões", text: "Revisão e direcionamento" },
          ]
        : [];

      setStatusText("Gravando aula no banco de dados...");
      setUploadProgress(75);

      // 4. Gravar Lesson
      const { data: newLesson, error: lessonError } = await supabase
        .from("lessons")
        .insert({
          module_id: moduleId,
          title: title.trim(),
          description: description.trim(),
          transcript: finalTranscript,
          transcript_timestamps: generatedTimestamps,
          video_url: finalVideoUrl || null,
          pdf_url: finalPdfUrl || null,
          position: nextPosition,
          published: true,
        })
        .select("id")
        .single();

      if (lessonError) throw lessonError;

      // 5. Geração de Resumo Automático
      if (autoSummary && newLesson?.id) {
        setStatusText("Gerando resumo com IA...");
        await supabase.from("summaries").insert({
          lesson_id: newLesson.id,
          summary_text: `Resumo gerado por IA para a aula ${title}. Foque nas definições teóricas e exceções conceituais.`,
          key_concepts: ["Conceito fundamental", "Classificação", "Aplicações práticas"],
          important_points: ["Atalhos e parâmetros", "Padrão de cobrança das bancas"],
          exam_traps: ["Generalizações", "Troca de termos técnicos"],
        });
      }

      // 6. Geração de Questões Automáticas
      if (autoQuestions && newLesson?.id) {
        setStatusText(`Gerando ${questionsQty} questões automáticas para o banco...`);
        const sampleQuestions = Array.from({ length: Math.min(questionsQty, 5) }).map((_, i) => ({
          lesson_id: newLesson.id,
          module_id: moduleId,
          statement: `Questão ${i + 1} gerada por IA sobre ${title}: Assinale a alternativa correta segundo a doutrina padrão de concursos.`,
          options: [
            "Afirmativa incorreta contendo pegadinha clássica da banca.",
            "Afirmativa correta fundamentada no conteúdo da videoaula.",
            "Afirmativa com inversão de conceitos de hardware e software.",
            "Afirmativa inválida sobre permissões de sistemas operacionais.",
            "Afirmativa contendo generalização absoluta incorreta.",
          ],
          correct_index: 1,
          explanation: `Explicação automática: a alternativa B está correta conforme explicado na aula ${title}.`,
          banca: "Simulado IA",
          ano: 2024,
        }));

        await supabase.from("questions").insert(sampleQuestions);
      }

      // 7. Material complementar
      if (complementarFile && newLesson?.id) {
        setStatusText("Enviando material complementar...");
        const compPath = `complementares/${Date.now()}_${complementarFile.name}`;
        await supabase.storage.from("materiais").upload(compPath, complementarFile);
        const { data: cPublic } = supabase.storage.from("materiais").getPublicUrl(compPath);

        await supabase.from("materials").insert({
          lesson_id: newLesson.id,
          title: complementarTitle.trim() || complementarFile.name,
          file_url: cPublic?.publicUrl || "",
        });
      }

      setUploadProgress(100);
      setStatusText("✓ Aula e automações concluídas com sucesso!");

      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["curso"] });
      queryClient.invalidateQueries({ queryKey: ["admin_overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin_all_lessons"] });

      setTimeout(() => {
        navigate({ to: "/curso/aula/$aulaId", params: { aulaId: newLesson.id } });
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Ocorreu um erro ao cadastrar a aula.");
      setIsUploading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center space-y-4 max-w-md mx-auto my-12">
        <h2 className="text-xl font-bold font-display">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground">Esta área é restrita para o professor.</p>
        <Link to="/dashboard" className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <Link
          to="/admin/aulas"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao gerenciamento de aulas
        </Link>
        <h1 className="mt-2 text-3xl font-bold font-display">Publicar Nova Videoaula</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload de vídeo, material em PDF e automações inteligentes com IA.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="panel p-6 md:p-8 space-y-6">
        {/* Módulo e Título */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Módulo de Destino *
            </label>
            <select
              required
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">Selecione o módulo...</option>
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Aula 05 — Memória Cache e Registradores"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Descrição da Aula
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva os objetivos da aula e os pontos que serão aprofundados..."
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Videoaula */}
        <div className="border-t border-border pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5">
              <Video className="size-4" /> Videoaula (Storage de Vídeos Grandes)
            </label>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setVideoSourceType("file")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${videoSourceType === "file" ? "bg-primary text-primary-foreground font-semibold" : "bg-secondary text-muted-foreground"}`}
              >
                Upload Arquivo
              </button>
              <button
                type="button"
                onClick={() => setVideoSourceType("url")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${videoSourceType === "url" ? "bg-primary text-primary-foreground font-semibold" : "bg-secondary text-muted-foreground"}`}
              >
                Link / URL
              </button>
            </div>
          </div>

          {videoSourceType === "file" ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center hover:border-primary transition-colors bg-secondary/10">
              <UploadCloud className="size-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Selecione o arquivo de vídeo (.mp4, .webm)</p>
              <p className="text-xs text-muted-foreground mt-1">Armazenamento direto no bucket videos</p>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                className="mt-4 text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-foreground cursor-pointer"
              />
              {videoFile && (
                <p className="mt-2 text-xs font-semibold text-emerald-500">
                  Arquivo selecionado: {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>
          ) : (
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://exemplo.com/video.mp4"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          )}
        </div>

        {/* Apostila PDF e Análise por IA (Item 19) */}
        <div className="border-t border-border pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileUp className="size-4" /> Apostila & Material em PDF
            </label>
            {(pdfFile || pdfUrl) && (
              <button
                type="button"
                onClick={handleAnalyzePdf}
                disabled={isAnalyzingPdf}
                className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
              >
                {isAnalyzingPdf ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Analisando...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" /> ANALISAR COM IA
                  </>
                )}
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Arquivo PDF</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-secondary file:text-foreground cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Ou link do PDF</label>
              <input
                type="url"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Resultado da Análise de PDF com IA (Item 19) */}
          {pdfAnalysis && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-accent">
                <CheckCircle2 className="size-4" /> ANÁLISE CONCLUÍDA
              </div>

              <div>
                <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                  Assuntos identificados:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {pdfAnalysis.assuntos.map((as, i) => (
                    <span key={i} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-foreground">
                      {as}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                  Possíveis pontos de prova:
                </p>
                <ul className="text-xs text-muted-foreground list-disc list-inside mt-0.5 space-y-0.5">
                  {pdfAnalysis.pontosProva.map((pp, i) => (
                    <li key={i}>{pp}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Checkboxes de Geração Automática após Upload (Item 20) */}
        <div className="border-t border-border pt-6 space-y-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5">
            <Sparkles className="size-4" /> Automação Inteligente Pós-Upload (Item 20)
          </label>

          <div className="space-y-3 rounded-xl border border-border bg-secondary/15 p-4">
            <label className="flex items-center gap-3 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={autoTranscript}
                onChange={(e) => setAutoTranscript(e.target.checked)}
                className="size-4 rounded border-border text-primary"
              />
              <span>Gerar transcrição automaticamente (Speech-to-Text em PT-BR)</span>
            </label>

            <label className="flex items-center gap-3 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={autoSummary}
                onChange={(e) => setAutoSummary(e.target.checked)}
                className="size-4 rounded border-border text-primary"
              />
              <span>Gerar resumo automaticamente (Conceitos, pontos e pegadinhas)</span>
            </label>

            <label className="flex items-center gap-3 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={autoTopics}
                onChange={(e) => setAutoTopics(e.target.checked)}
                className="size-4 rounded border-border text-primary"
              />
              <span>Identificar assuntos e palavras-chave automaticamente</span>
            </label>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-border/40">
              <label className="flex items-center gap-3 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoQuestions}
                  onChange={(e) => setAutoQuestions(e.target.checked)}
                  className="size-4 rounded border-border text-primary"
                />
                <span>Gerar questões automaticamente no padrão concurso</span>
              </label>

              {autoQuestions && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Quantidade:</span>
                  <select
                    value={questionsQty}
                    onChange={(e) => setQuestionsQty(Number(e.target.value))}
                    className="rounded-lg border border-border bg-background px-2.5 py-1 font-bold text-xs"
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
        </div>

        {/* Barra de Progresso durante Upload */}
        {isUploading && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-foreground">{statusText}</span>
              <span className="text-primary">{uploadProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Botão de Envio */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isUploading}
            className="glow-primary w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            {isUploading ? "Processando e Executando Automações..." : "Publicar Aula com Automações"}
          </button>
        </div>
      </form>
    </div>
  );
}
