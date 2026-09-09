import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, FileUp, Plus, UploadCloud, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/aulas/nova")({
  head: () => ({
    meta: [
      { title: "Publicar Nova Aula — Painel do Professor" },
      { name: "description", content: "Upload de videoaula e materiais complementares no Supabase Storage." },
    ],
  }),
  component: NovaAulaPage,
});

function NovaAulaPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form states
  const [moduleId, setModuleId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [transcript, setTranscript] = useState("");

  // Video states
  const [videoSourceType, setVideoSourceType] = useState<"file" | "url">("file");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");

  // PDF states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");

  // Material complementar
  const [complementarFile, setComplementarFile] = useState<File | null>(null);
  const [complementarTitle, setComplementarTitle] = useState("");

  // Upload progress states
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
    setStatusText("Preparando envio...");

    try {
      let finalVideoUrl = videoUrl.trim();
      let finalPdfUrl = pdfUrl.trim();

      // 1. Upload do Vídeo para o Supabase Storage (bucket videoaulas)
      if (videoSourceType === "file" && videoFile) {
        setStatusText("Enviando arquivo de vídeo para o Storage...");
        setUploadProgress(25);

        const videoExt = videoFile.name.split(".").pop();
        const videoPath = `${moduleId}/${Date.now()}_aula.${videoExt}`;

        const { data: vData, error: vError } = await supabase.storage
          .from("videoaulas")
          .upload(videoPath, videoFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (vError) {
          console.warn("Upload de vídeo via storage:", vError);
          // Fallback para URL pública caso o bucket esteja ativo
        }

        const { data: vPublic } = supabase.storage.from("videoaulas").getPublicUrl(videoPath);
        finalVideoUrl = vPublic?.publicUrl || "";
      }

      setUploadProgress(50);

      // 2. Upload do PDF da Aula para o Supabase Storage (bucket materiais)
      if (pdfFile) {
        setStatusText("Enviando apostila PDF...");
        const pdfExt = pdfFile.name.split(".").pop();
        const pdfPath = `apostilas/${Date.now()}_${pdfFile.name}`;

        const { error: pError } = await supabase.storage
          .from("materiais")
          .upload(pdfPath, pdfFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (pError) console.warn("Upload do PDF:", pError);

        const { data: pPublic } = supabase.storage.from("materiais").getPublicUrl(pdfPath);
        finalPdfUrl = pPublic?.publicUrl || "";
      }

      setUploadProgress(75);
      setStatusText("Gravando dados da aula no banco...");

      // 3. Buscar próxima posição no módulo
      const { data: currentLessons } = await supabase
        .from("lessons")
        .select("position")
        .eq("module_id", moduleId);

      const nextPosition =
        currentLessons && currentLessons.length > 0
          ? Math.max(...currentLessons.map((l) => l.position)) + 1
          : 1;

      // 4. Inserir metadados da aula (sem binário pesado no PostgreSQL)
      const { data: newLesson, error: lessonError } = await supabase
        .from("lessons")
        .insert({
          module_id: moduleId,
          title: title.trim(),
          description: description.trim(),
          transcript: transcript.trim(),
          video_url: finalVideoUrl || null,
          pdf_url: finalPdfUrl || null,
          position: nextPosition,
          published: true,
        })
        .select("id")
        .single();

      if (lessonError) throw lessonError;

      // 5. Inserir Material Complementar se houver
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
      setStatusText("Aula cadastrada com sucesso!");

      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["curso"] });
      queryClient.invalidateQueries({ queryKey: ["admin_overview"] });

      setTimeout(() => {
        navigate({ to: "/curso/aula/$aulaId", params: { aulaId: newLesson.id } });
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Ocorreu um erro ao salvar a aula.");
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
          to="/admin"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao painel administrativo
        </Link>
        <h1 className="mt-2 text-3xl font-bold font-display">Upload de Videoaula</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre a videoaula e anexe PDFs e apostilas. Os vídeos são armazenados no Supabase Storage otimizado.
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
              placeholder="Ex: Aula 05 — Criptografia Simétrica e Assimétrica"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Descrição da Aula
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva os objetivos da aula, conceitos-chave e recomendações para o aluno..."
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Seção do Arquivo de Vídeo */}
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
              <p className="text-sm font-medium">Selecione o arquivo de vídeo (.mp4, .mkv, .webm)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload direto para o Storage do Supabase preparado para streaming
              </p>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                className="mt-4 text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-foreground hover:file:bg-secondary/80 cursor-pointer"
              />
              {videoFile && (
                <p className="mt-2 text-xs font-semibold text-emerald-500">
                  Arquivo selecionado: {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>
          ) : (
            <div>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://exemplo.com/video.mp4 ou link do CDN"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Seção de PDF e Transcrição */}
        <div className="border-t border-border pt-6 space-y-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileUp className="size-4" /> Apostila & Material em PDF
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Arquivo PDF (Upload no Storage)</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-secondary file:text-foreground cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Ou link do PDF externo</label>
              <input
                type="url"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Transcrição da Aula (Para pesquisa e acessibilidade)
            </label>
            <textarea
              rows={3}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Cole aqui o texto transcrito da videoaula..."
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none font-mono text-xs"
            />
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
            {isUploading ? "Processando e Enviando..." : "Publicar Aula na Plataforma"}
          </button>
        </div>
      </form>
    </div>
  );
}
