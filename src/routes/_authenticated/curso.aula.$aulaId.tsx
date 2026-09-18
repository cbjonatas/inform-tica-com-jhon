import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { QuestionList } from "@/components/QuestionList";
import { AssistenteIA } from "@/components/AssistenteIA";

export const Route = createFileRoute("/_authenticated/curso/aula/$aulaId")({
  head: () => ({
    meta: [
      { title: "Aula — Informática com Jhon" },
      { name: "description", content: "Assista à videoaula, leia a transcrição e resolva questões." },
      { property: "og:title", content: "Aula — Informática com Jhon" },
      { property: "og:description", content: "Videoaula, material em PDF, questões e IA." },
    ],
  }),
  component: AulaPage,
});

type Aba = "descricao" | "transcricao" | "pdf" | "questoes" | "ia";

async function resolverUrl(bucket: string, valor: string | null) {
  if (!valor) return null;
  if (valor.startsWith("http")) return valor;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(valor, 60 * 60 * 4);
  return data?.signedUrl ?? null;
}

function AulaPage() {
  const { aulaId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [aba, setAba] = useState<Aba>("descricao");
  const restaurado = useRef(false);

  const { data } = useQuery({
    queryKey: ["aula", aulaId],
    queryFn: async () => {
      const { data: aula } = await supabase.from("lessons").select("*").eq("id", aulaId).maybeSingle();
      const [modulo, materiais, progresso] = await Promise.all([
        aula?.module_id
          ? supabase.from("modules").select("*").eq("id", aula.module_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("materials").select("*").eq("lesson_id", aulaId),
        supabase.from("lesson_progress").select("*").eq("lesson_id", aulaId).maybeSingle(),
      ]);
      const videoUrl = await resolverUrl("videoaulas", aula?.video_url ?? null);
      const pdfUrl = await resolverUrl("materiais", aula?.pdf_url ?? null);
      return {
        aula,
        modulo: modulo.data,
        materiais: materiais.data ?? [],
        progresso: progresso.data,
        videoUrl,
        pdfUrl,
      };
    },
  });

  const aula = data?.aula;
  const concluida = Boolean(data?.progresso?.completed);

  const salvar = async (segundos: number, completed?: boolean) => {
    if (!user) return;
    await supabase.from("lesson_progress").upsert(
      {
        user_id: user.id,
        lesson_id: aulaId,
        position_seconds: Math.floor(segundos),
        ...(completed === undefined ? {} : { completed }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    );
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v || restaurado.current || !data) return;
    const pos = data.progresso?.position_seconds ?? 0;
    if (pos > 0) v.currentTime = pos;
    restaurado.current = true;
  }, [data]);

  useEffect(() => {
    const id = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused) void salvar(v.currentTime);
    }, 10000);
    return () => clearInterval(id);
  });

  const marcarConcluida = async () => {
    await salvar(videoRef.current?.currentTime ?? 0, true);
    await qc.invalidateQueries({ queryKey: ["aula", aulaId] });
    toast.success("Aula marcada como concluída");
  };

  const abas: { id: Aba; label: string }[] = [
    { id: "descricao", label: "DESCRIÇÃO" },
    { id: "transcricao", label: "TRANSCRIÇÃO" },
    { id: "pdf", label: "PDF" },
    { id: "questoes", label: "QUESTÕES" },
    { id: "ia", label: "IA" },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/curso/modulo/$moduloId"
            params={{ moduloId: aula?.module_id ?? "" }}
            className="text-xs tracking-widest text-accent hover:underline"
          >
            {data?.modulo?.title ?? "MÓDULO"}
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">{aula?.title ?? "Carregando..."}</h1>
        </div>
        <span className={cn("text-sm", concluida ? "text-success" : "text-muted-foreground")}>
          {concluida ? "Aula concluída" : "Em andamento"}
        </span>
      </header>

      <div className="panel overflow-hidden">
        {data?.videoUrl ? (
          <video ref={videoRef} controls className="aspect-video w-full bg-black" src={data.videoUrl} onPause={(e) => void salvar(e.currentTarget.currentTime)} onEnded={() => void marcarConcluida()} />
        ) : (
          <div className="grid aspect-video w-full place-items-center bg-secondary/40 px-6 text-center text-sm text-muted-foreground">
            O vídeo desta aula ainda não foi enviado pelo professor.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={cn(
              "rounded-lg border px-4 py-2 text-xs font-semibold tracking-widest transition-colors",
              aba === a.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
            )}
          >
            {a.label}
          </button>
        ))}
        {!concluida && (
          <button
            onClick={() => void marcarConcluida()}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-success/40 px-4 py-2 text-xs font-semibold tracking-widest text-success"
          >
            <CheckCircle2 className="size-4" /> MARCAR COMO CONCLUÍDA
          </button>
        )}
      </div>

      <div className="panel p-6">
        {aba === "descricao" && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {aula?.description || "Sem descrição cadastrada para esta aula."}
          </p>
        )}
        {aba === "transcricao" && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {aula?.transcript || "A transcrição desta aula ainda não foi publicada."}
          </p>
        )}
        {aba === "pdf" && (
          <div className="space-y-3">
            {data?.pdfUrl ? (
              <a
                href={data.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                <FileText className="size-4" /> Abrir PDF da aula
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum PDF disponível nesta aula.</p>
            )}
            {(data?.materiais ?? []).map((m) => (
              <a key={m.id} href={m.file_url} target="_blank" rel="noreferrer" className="block text-sm text-primary hover:underline">
                {m.title}
              </a>
            ))}
          </div>
        )}
        {aba === "questoes" && <QuestionList lessonId={aulaId} />}
        {aba === "ia" && (
          <AssistenteIA
            contexto={`Aula: ${aula?.title ?? ""}. Módulo: ${data?.modulo?.title ?? ""}. Descrição: ${aula?.description ?? ""}`}
          />
        )}
      </div>
    </div>
  );
}
