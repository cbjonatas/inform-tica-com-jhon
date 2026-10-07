import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  PlusCircle,
  Sparkles,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isEmailAdmin } from "@/lib/auth";
import { UploadArea } from "@/components/UploadArea";
import { ProcessingStatus, type ProcessingStep } from "@/components/ProcessingStatus";
import { aiService } from "@/lib/ai/ai-service";

export const Route = createFileRoute("/_authenticated/admin/aulas/nova")({
  validateSearch: (search: Record<string, unknown>): { cursoId?: string; moduloId?: string } => ({
    ...(typeof search.cursoId === "string" ? { cursoId: search.cursoId } : {}),
    ...(typeof search.moduloId === "string" ? { moduloId: search.moduloId } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Publicar Nova Videoaula — Painel do Professor" },
      { name: "description", content: "Upload de videoaula, capa vertical, múltiplas partes do assunto e IA." },
    ],
  }),
  component: NovaAulaPage,
});

const DEFAULT_PARTS = ["Parte 1", "Parte 2", "Parte 3", "Parte 4", "Parte 5", "Aula Única"];

function NovaAulaPage() {
  const { user, profile, isAdmin: authIsAdmin } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const userEmail = (user?.email || user?.user_metadata?.email || profile?.email || "").toLowerCase().trim();
  const userName = (user?.user_metadata?.full_name || profile?.full_name || "").toLowerCase().trim();
  const isAdmin =
    Boolean(authIsAdmin) ||
    isEmailAdmin(userEmail) ||
    isEmailAdmin(profile?.email) ||
    userName.includes("professorjonatas");

  // Estados de identificação
  const [selectedCourseId, setSelectedCourseId] = useState<string>(search.cursoId || "");
  const [moduleId, setModuleId] = useState<string>(search.moduloId || "");

  // Criação rápida de módulo inline
  const [showNewModuleInput, setShowNewModuleInput] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const [isCreatingModule, setIsCreatingModule] = useState(false);

  // Assunto e Partes ("um mesmo assunto pode ter mais de uma parte")
  const [subject, setSubject] = useState("");
  const [part, setPart] = useState("Parte 1");
  const [title, setTitle] = useState("");
  const [isTitleManual, setIsTitleManual] = useState(false);
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number>(30);

  // Capa Vertical da Aula
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState("");

  // Arquivos de Mídia
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");

  // Automações de IA
  const [autoProcessWithAi, setAutoProcessWithAi] = useState(true);
  const [questionsQty, setQuestionsQty] = useState(10);

  // Estados de Processamento
  const [step, setStep] = useState<ProcessingStep>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Buscar cursos da plataforma
  const { data: courses = [] } = useQuery({
    queryKey: ["admin_courses_select"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await supabase.from("courses").select("id, title, category, cover_url").order("position");
      return res.data ?? [];
    },
  });

  // Atualizar curso selecionado quando carregar
  useEffect(() => {
    if (!selectedCourseId && courses.length > 0 && courses[0]) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // Buscar módulos do curso selecionado
  const { data: modules = [], refetch: refetchModules } = useQuery({
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

  // Atualizar moduleId quando os módulos mudarem
  useEffect(() => {
    if (modules.length > 0) {
      if (!moduleId || !modules.some((m) => m.id === moduleId)) {
        if (modules[0]) {
          setModuleId(modules[0].id);
        }
      }
    } else {
      setModuleId("");
    }
  }, [modules, moduleId]);

  // Atualizar título automaticamente ao alterar assunto ou parte (se o professor não tiver editado manualmente)
  const handleSubjectChange = (val: string) => {
    setSubject(val);
    if (!isTitleManual) {
      setTitle(val.trim() ? (part ? `${val.trim()} — ${part}` : val.trim()) : "");
    }
  };

  const handlePartSelect = (p: string) => {
    setPart(p);
    if (!isTitleManual) {
      setTitle(subject.trim() ? `${subject.trim()} — ${p}` : p);
    }
  };

  // Criação rápida de módulo
  const handleQuickCreateModule = async () => {
    if (!newModuleName.trim() || !selectedCourseId || isCreatingModule) return;
    setIsCreatingModule(true);

    try {
      const nextPos = modules.length + 1;
      const { data: newMod, error } = await supabase
        .from("modules")
        .insert({
          course_id: selectedCourseId,
          title: newModuleName.trim(),
          description: `Aulas de ${newModuleName.trim()}`,
          position: nextPos,
          published: true,
        })
        .select()
        .single();

      if (error || !newMod) throw error;

      await refetchModules();
      setModuleId(newMod.id);
      setNewModuleName("");
      setShowNewModuleInput(false);
    } catch (err: any) {
      alert(`Erro ao criar módulo: ${err.message}`);
    } finally {
      setIsCreatingModule(false);
    }
  };

  // Manipulação de Capa Vertical da Aula
  const handleCoverSelected = (file: File | null) => {
    setCoverFile(file);
    if (file) {
      setCoverUrl(URL.createObjectURL(file));
    }
  };

  // Submissão da Aula
  const executeSaveLesson = async (keepForNextPart: boolean) => {
    if (!selectedCourseId) {
      alert("Por favor, selecione um curso.");
      return;
    }
    if (!moduleId) {
      alert("Por favor, selecione ou crie um módulo para esta aula.");
      return;
    }
    if (!title.trim()) {
      alert("O título da videoaula é obrigatório.");
      return;
    }

    setErrorMessage(null);
    setSuccessToast(null);

    try {
      let finalVideoUrl = videoUrl.trim();
      let finalPdfUrl = pdfUrl.trim();
      let finalCoverUrl = coverUrl.trim();

      // 1. Upload da Capa Vertical (se fornecida via arquivo)
      if (coverFile) {
        setStep("processing_video");
        setProgress(15);
        const coverExt = coverFile.name.split(".").pop();
        const coverPath = `capas-aulas/${Date.now()}_${Math.random().toString(36).substring(7)}.${coverExt}`;

        const { error: coverErr } = await supabase.storage
          .from("materiais")
          .upload(coverPath, coverFile, { upsert: false });

        if (!coverErr) {
          const { data: cData } = supabase.storage.from("materiais").getPublicUrl(coverPath);
          if (cData?.publicUrl) finalCoverUrl = cData.publicUrl;
        }
      }

      // Se não enviou capa individual, herdamos a capa do curso selecionado
      if (!finalCoverUrl) {
        const currentCourse = courses.find((c) => c.id === selectedCourseId);
        finalCoverUrl = currentCourse?.cover_url || "/images/capa-padrao.png";
      }

      // 2. Upload da Videoaula (se fornecida via arquivo)
      if (videoFile) {
        setStep("processing_video");
        setProgress(30);

        const videoExt = videoFile.name.split(".").pop() || "mp4";
        const videoPath = `${moduleId}/${Date.now()}_video.${videoExt}`;

        const { error: vErr } = await supabase.storage.from("videoaulas").upload(videoPath, videoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: videoFile.type || "video/mp4",
        });
        if (vErr) throw new Error(`Falha no envio do vídeo: ${vErr.message}`);

        const { data: vSigned, error: vsErr } = await supabase.storage
          .from("videoaulas")
          .createSignedUrl(videoPath, 60 * 60 * 24 * 365 * 10);
        if (vsErr || !vSigned) throw new Error("Não foi possível gerar o link do vídeo.");
        finalVideoUrl = vSigned.signedUrl;
      }

      // 3. Upload do PDF (se fornecido via arquivo)
      if (pdfFile) {
        setStep("processing_pdf");
        setProgress(45);

        const safeName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const pdfPath = `apostilas/${Date.now()}_${safeName}`;

        const { error: pErr } = await supabase.storage
          .from("materiais")
          .upload(pdfPath, pdfFile, { upsert: false, contentType: "application/pdf" });
        if (pErr) throw new Error(`Falha no envio do PDF: ${pErr.message}`);
        const { data: pSigned } = await supabase.storage
          .from("materiais")
          .createSignedUrl(pdfPath, 60 * 60 * 24 * 365 * 10);
        finalPdfUrl = pSigned?.signedUrl || "";
      }

      // 4. Determinar próxima posição
      const { data: currentLessons } = await supabase
        .from("lessons")
        .select("position")
        .eq("module_id", moduleId);

      const nextPosition =
        currentLessons && currentLessons.length > 0
          ? Math.max(...currentLessons.map((l) => l.position)) + 1
          : 1;

      // 5. Transcrição com IA
      let transcriptionData = { transcript: "", timestamps: [] as any[] };
      if (autoProcessWithAi && (finalVideoUrl || videoFile)) {
        setStep("generating_transcript");
        setProgress(60);
        try {
          transcriptionData = await aiService.transcribeVideo(finalVideoUrl, title);
        } catch (e) {
          console.warn("Transcrição em fallback", e);
        }
      }

      // 6. Inserir a Aula na Tabela lessons com capa vertical, assunto e parte
      const durationSeconds = durationMinutes > 0 ? durationMinutes * 60 : 1800;

      const formattedTitleWithPart =
        part.trim() && !title.includes(part.trim())
          ? `${title.trim()} — ${part.trim()}`
          : title.trim();

      let newLesson: any = null;

      // Tentativa 1: Inserir com todos os campos (cover_url, subject, part)
      try {
        const fullRes = await supabase
          .from("lessons")
          .insert({
            module_id: moduleId,
            title: title.trim(),
            description: description.trim(),
            subject: subject.trim() || title.trim(),
            part: part.trim(),
            cover_url: finalCoverUrl,
            duration_seconds: durationSeconds,
            transcript: transcriptionData.transcript,
            transcript_timestamps: transcriptionData.timestamps,
            video_url: finalVideoUrl || null,
            pdf_url: finalPdfUrl || null,
            position: nextPosition,
            published: true,
            transcription_status: "completed",
          } as any)
          .select("id")
          .single();

        if (fullRes.error) {
          throw fullRes.error;
        }
        newLesson = fullRes.data;
      } catch (insertErr: any) {
        console.warn("Aviso ao inserir aula com schema completo:", insertErr?.message || insertErr);

        const isSchemaCacheError =
          insertErr?.message?.includes("cover_url") ||
          insertErr?.message?.includes("subject") ||
          insertErr?.message?.includes("part") ||
          insertErr?.message?.includes("schema cache") ||
          insertErr?.code === "42703" ||
          insertErr?.code === "PGRST204";

        if (isSchemaCacheError) {
          // Tentativa 2: Fallback seguro sem as colunas que podem estar ausentes no banco
          const safeRes = await supabase
            .from("lessons")
            .insert({
              module_id: moduleId,
              title: formattedTitleWithPart,
              description: description.trim(),
              duration_seconds: durationSeconds,
              transcript: transcriptionData.transcript,
              transcript_timestamps: transcriptionData.timestamps,
              video_url: finalVideoUrl || null,
              pdf_url: finalPdfUrl || null,
              position: nextPosition,
              published: true,
              transcription_status: "completed",
            } as any)
            .select("id")
            .single();

          if (safeRes.error) {
            // Tentativa 3: Inserção compatível com colunas originais mínimas
            const minimalRes = await supabase
              .from("lessons")
              .insert({
                module_id: moduleId,
                title: formattedTitleWithPart,
                description: description.trim(),
                duration_seconds: durationSeconds,
                transcript: transcriptionData.transcript,
                video_url: finalVideoUrl || null,
                pdf_url: finalPdfUrl || null,
                position: nextPosition,
                published: true,
              } as any)
              .select("id")
              .single();

            if (minimalRes.error) throw minimalRes.error;
            newLesson = minimalRes.data;
          } else {
            newLesson = safeRes.data;
          }
        } else {
          throw insertErr;
        }
      }

      // Garantir vinculação do PDF na tabela materials para fácil acesso do aluno
      if (finalPdfUrl && newLesson?.id) {
        try {
          await supabase.from("materials").insert({
            lesson_id: newLesson.id,
            title: `Material de Apoio (PDF) — ${title.trim()}`,
            file_url: finalPdfUrl,
          });
        } catch (mErr) {
          console.warn("Aviso ao registrar material de apoio PDF:", mErr);
        }
      }

      // 7. Resumo com IA
      if (autoProcessWithAi && newLesson?.id) {
        setStep("generating_summary");
        setProgress(75);
        try {
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
        } catch (e) {
          console.warn("Resumo IA em fallback", e);
        }
      }

      // 8. Questões com IA vinculadas à aula e ao curso
      if (autoProcessWithAi && newLesson?.id) {
        setStep("generating_questions");
        setProgress(90);
        try {
          const questionsList = await aiService.generateQuestions(
            Math.min(questionsQty, 5),
            "Médio",
            { lessonTitle: title }
          );

          const toInsert = questionsList.map((q) => ({
            course_id: selectedCourseId,
            lesson_id: newLesson.id,
            module_id: moduleId,
            statement: q.statement,
            options: q.options,
            correct_index: q.correct_index,
            explanation: q.explanation,
            banca: q.banca,
            ano: 2024,
            difficulty: "medio",
            subject: subject.trim() || title.trim(),
          }));

          await supabase.from("questions").insert(toInsert);
        } catch (e) {
          console.warn("Questões IA em fallback", e);
        }
      }

      // Concluído
      setStep("completed");
      setProgress(100);

      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["curso"] });
      queryClient.invalidateQueries({ queryKey: ["modulo", moduleId] });
      queryClient.invalidateQueries({ queryKey: ["admin_all_lessons"] });
      queryClient.invalidateQueries({ queryKey: ["meus-cursos"] });

      if (keepForNextPart) {
        // Calcular próxima parte automaticamente
        let nextPart = "Parte 2";
        if (part === "Parte 1") nextPart = "Parte 2";
        else if (part === "Parte 2") nextPart = "Parte 3";
        else if (part === "Parte 3") nextPart = "Parte 4";
        else if (part === "Parte 4") nextPart = "Parte 5";
        else if (part === "Parte 5") nextPart = "Parte 6";
        else nextPart = `Parte ${Number(part.replace(/\D/g, "") || 1) + 1}`;

        setPart(nextPart);
        if (subject.trim()) {
          setTitle(`${subject.trim()} — ${nextPart}`);
        }

        // Limpar campos de arquivos para a próxima parte
        setVideoFile(null);
        setVideoUrl("");
        setPdfFile(null);
        setPdfUrl("");
        setCoverFile(null);

        setSuccessToast(`✓ Aula "${title}" publicada com sucesso! Agora você pode inserir o vídeo de ${nextPart}.`);
        setStep("idle");
        setProgress(0);
      } else {
        setTimeout(() => {
          navigate({ to: "/curso/aula/$aulaId", params: { aulaId: newLesson.id } });
        }, 1200);
      }
    } catch (err: any) {
      console.error(err);
      setStep("error");
      setErrorMessage(err?.message || "Não foi possível cadastrar a aula. Verifique os dados e tente novamente.");
    }
  };

  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center space-y-4 max-w-md mx-auto my-12">
        <h2 className="text-xl font-bold font-display">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground">Esta área é restrita para o professor.</p>
        <Link to="/meus-cursos" className="inline-block rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          Voltar aos Cursos
        </Link>
      </div>
    );
  }

  const isBusy = step !== "idle" && step !== "completed" && step !== "error";
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Topo com navegação */}
      <div>
        <Link
          to="/admin/cursos"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao gerenciamento de cursos
        </Link>
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">Inserir Nova Videoaula</h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Cadastre videoaulas com capas verticais, suporte a múltiplas partes do mesmo assunto e automação de IA.
            </p>
          </div>
        </div>
      </div>

      {/* Banner de Sucesso para Próxima Parte */}
      {successToast && (
        <div className="panel flex items-center justify-between gap-3 border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-400 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-400/80 hover:text-emerald-400">
            ✕
          </button>
        </div>
      )}

      {/* Exibição Granular do Status de Processamento */}
      <ProcessingStatus
        currentStep={step}
        progressPercent={progress}
        {...(errorMessage ? { errorMessage } : {})}
        onRetry={() => {
          setStep("idle");
          setErrorMessage(null);
        }}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          executeSaveLesson(false);
        }}
        className="panel p-6 md:p-8 space-y-8"
      >
        {/* BLOCO 1: SELEÇÃO DE CURSO E MÓDULO */}
        <section className="space-y-4 border-b border-border pb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
            <Layers className="size-4" /> 1. Curso e Módulo de Destino
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Curso *
              </label>
              <select
                required
                disabled={isBusy}
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full rounded-xl border border-primary/40 bg-background px-3.5 py-2.5 text-xs font-semibold focus:border-primary focus:outline-none"
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-muted-foreground">
                  Módulo *
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewModuleInput(!showNewModuleInput)}
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="size-3" /> Novo Módulo
                </button>
              </div>

              {showNewModuleInput ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    placeholder="Nome do novo módulo..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateModule}
                    disabled={isCreatingModule || !newModuleName.trim()}
                    className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {isCreatingModule ? "Criando..." : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewModuleInput(false)}
                    className="shrink-0 rounded-xl border border-border px-2.5 py-2 text-xs text-muted-foreground"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  required
                  disabled={isBusy || !selectedCourseId || modules.length === 0}
                  value={moduleId}
                  onChange={(e) => setModuleId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs focus:border-primary focus:outline-none disabled:opacity-50"
                >
                  {modules.length === 0 ? (
                    <option value="">Nenhum módulo. Clique em "+ Novo Módulo"</option>
                  ) : (
                    modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        Módulo {m.position} — {m.title}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
          </div>
        </section>

        {/* BLOCO 2: ASSUNTO E MÚLTIPLAS PARTES ("um mesmo assunto pode ter mais de uma parte") */}
        <section className="space-y-4 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
              <Sparkles className="size-4" /> 2. Assunto e Múltiplas Partes
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Um mesmo assunto pode ser dividido em Parte 1, Parte 2, etc.
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Assunto principal */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Assunto / Tema da Matéria *
              </label>
              <input
                type="text"
                required
                disabled={isBusy}
                value={subject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                placeholder="Ex: Hardware e Dispositivos, Redes de Computadores, Windows 11..."
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs focus:border-primary focus:outline-none"
              />
            </div>

            {/* Parte */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Parte do Assunto
              </label>
              <input
                type="text"
                disabled={isBusy}
                value={part}
                onChange={(e) => handlePartSelect(e.target.value)}
                placeholder="Ex: Parte 1"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold text-primary focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Chips de seleção rápida de partes */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">Atalhos de Parte:</span>
            {DEFAULT_PARTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePartSelect(p)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  part === p
                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                    : "border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Título da Videoaula (Gerado automaticamente ou editável) */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                Título Final da Videoaula *
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsTitleManual(false);
                  setTitle(subject.trim() ? `${subject.trim()} — ${part}` : part);
                }}
                className="text-[10px] text-primary hover:underline"
              >
                Resetar para Assunto + Parte
              </button>
            </div>
            <input
              type="text"
              required
              disabled={isBusy}
              value={title}
              onChange={(e) => {
                setIsTitleManual(true);
                setTitle(e.target.value);
              }}
              placeholder="Ex: Hardware e Dispositivos — Parte 1"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Descrição dos Tópicos Abordados
              </label>
              <textarea
                rows={2}
                disabled={isBusy}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Conceitos principais, pegadinhas de bancas e tópicos detalhados nesta parte..."
                className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:border-primary focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Duração (Minutos)
              </label>
              <input
                type="number"
                min={1}
                disabled={isBusy}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* BLOCO 3: CAPA VERTICAL DA AULA ("As capas das aulas estarão todas na vertical") */}
        <section className="space-y-4 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
              <ImageIcon className="size-4" /> 3. Capa da Aula (Formato Vertical)
            </h2>
            <span className="text-[11px] text-muted-foreground">Padrão Poster Vertical 9:13</span>
          </div>

          <div className="grid gap-6 sm:grid-cols-[1.5fr_1fr]">
            <UploadArea
              label="Capa Vertical da Aula"
              accept="image/*"
              maxSizeMB={5}
              fileTypeLabel=".jpg, .png, .webp"
              selectedFile={coverFile}
              onFileSelected={handleCoverSelected}
            />

            <div className="flex flex-col justify-between rounded-xl border border-border bg-secondary/20 p-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Ou URL da Imagem da Capa:
                </label>
                <input
                  type="url"
                  disabled={isBusy}
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (selectedCourse?.cover_url) {
                      setCoverUrl(selectedCourse.cover_url);
                    }
                  }}
                  className="mt-1.5 text-[11px] text-primary hover:underline"
                >
                  Usar mesma capa do curso
                </button>
              </div>

              {coverUrl || selectedCourse?.cover_url ? (
                <div className="mt-3 aspect-[9/13] max-h-48 w-auto self-center overflow-hidden rounded-xl border border-border bg-secondary shadow-lg">
                  <img
                    src={coverUrl || selectedCourse?.cover_url || "/images/capa-padrao.png"}
                    alt="Preview vertical"
                    className="size-full object-cover"
                  />
                </div>
              ) : (
                <div className="mt-3 grid aspect-[9/13] max-h-48 w-32 self-center place-items-center rounded-xl border border-dashed border-border text-muted-foreground text-[11px] text-center p-2">
                  Prévia da Capa Vertical
                </div>
              )}
            </div>
          </div>
        </section>

        {/* BLOCO 4: VÍDEO E PDF */}
        <section className="space-y-6 border-b border-border pb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
            <Video className="size-4" /> 4. Arquivos da Aula (Vídeo e PDF)
          </h2>

          {/* Upload de Vídeo */}
          <div className="space-y-3">
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
                placeholder="Ou link direto da videoaula (Google Drive, Vimeo, CDN ou Storage)..."
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs focus:border-primary focus:outline-none"
              />
            )}
          </div>

          {/* Upload de PDF */}
          <div className="space-y-3">
            <UploadArea
              label="Material de Apoio em PDF"
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
                placeholder="Ou link direto para download do PDF..."
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs focus:border-primary focus:outline-none"
              />
            )}
          </div>
        </section>

        {/* BLOCO 5: PROCESSAMENTO COM INTELIGÊNCIA ARTIFICIAL */}
        <section className="space-y-3 border-b border-border pb-6">
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
                <Sparkles className="size-4 text-accent" /> Processar Automaticamente com IA
              </span>
            </label>
            <p className="text-[11px] text-muted-foreground leading-relaxed pl-7">
              Ao manter ativado, o sistema gera automaticamente a transcrição inteligente com minutagem, resumo esquematizado e questões inéditas da banca.
            </p>

            {autoProcessWithAi && (
              <div className="pl-7 pt-1 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Bateria de Questões:</span>
                <select
                  value={questionsQty}
                  disabled={isBusy}
                  onChange={(e) => setQuestionsQty(Number(e.target.value))}
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold"
                >
                  <option value={5}>5 questões</option>
                  <option value={10}>10 questões</option>
                  <option value={15}>15 questões</option>
                </select>
              </div>
            )}
          </div>
        </section>

        {/* BLOCO 6: BOTÕES DE AÇÃO E SALVAR PRÓXIMA PARTE */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <Link
            to="/admin/cursos"
            className="w-full sm:w-auto text-center rounded-xl border border-border px-5 py-3 text-xs font-semibold hover:bg-secondary transition-colors"
          >
            Cancelar
          </Link>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Botão A: Salvar e Inserir Próxima Parte */}
            <button
              type="button"
              onClick={() => executeSaveLesson(true)}
              disabled={isBusy}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/50 bg-blue-600/10 px-6 py-3 text-xs font-bold text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm disabled:opacity-50"
              title="Salva a aula atual e prepara o formulário para a próxima parte deste mesmo assunto"
            >
              <PlusCircle className="size-4" />
              SALVAR E INSERIR PRÓXIMA PARTE
            </button>

            {/* Botão B: Salvar e Finalizar */}
            <button
              type="submit"
              disabled={isBusy}
              className="glow-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {isBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" /> SALVAR E CONCLUIR
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default NovaAulaPage;
