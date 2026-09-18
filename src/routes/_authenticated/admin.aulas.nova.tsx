import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/aulas/nova")({
  head: () => ({
    meta: [
      { title: "Nova aula — Informática com Jhon" },
      { name: "description", content: "Envie videoaula, PDF e materiais complementares para o curso." },
      { property: "og:title", content: "Nova aula — Informática com Jhon" },
      { property: "og:description", content: "Cadastro de videoaulas da plataforma." },
    ],
  }),
  component: NovaAula,
});

const campo = "w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary";

function NovaAula() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState("");
  const [moduloId, setModuloId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [materiais, setMateriais] = useState<FileList | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [etapa, setEtapa] = useState("");

  const { data: modulos } = useQuery({
    queryKey: ["admin-modulos"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("modules").select("id, title").order("position")).data ?? [],
  });

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduloId) {
      toast.error("Selecione o módulo");
      return;
    }
    setEnviando(true);
    try {

      let videoPath: string | null = null;
      if (video) {
        setEtapa("Enviando vídeo...");
        const path = `${moduloId}/${Date.now()}-${video.name}`;
        const { error } = await supabase.storage.from("videoaulas").upload(path, video, {
          contentType: video.type,
          upsert: false,
        });
        if (error) throw error;
        videoPath = path;
      }

      let pdfPath: string | null = null;
      if (pdf) {
        setEtapa("Enviando PDF...");
        const path = `${moduloId}/${Date.now()}-${pdf.name}`;
        const { error } = await supabase.storage.from("materiais").upload(path, pdf, { contentType: pdf.type });
        if (error) throw error;
        pdfPath = path;
      }

      setEtapa("Salvando aula...");
      const { count } = await supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("module_id", moduloId);

      const { data: aula, error } = await supabase
        .from("lessons")
        .insert({
          module_id: moduloId,
          title: titulo,
          description: descricao,
          video_url: videoPath,
          pdf_url: pdfPath,
          position: (count ?? 0) + 1,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (materiais && materiais.length && aula) {
        setEtapa("Enviando materiais complementares...");
        for (const arquivo of Array.from(materiais)) {
          const path = `${moduloId}/${Date.now()}-${arquivo.name}`;
          const { error: upErr } = await supabase.storage.from("materiais").upload(path, arquivo);
          if (upErr) throw upErr;
          const { data: signed } = await supabase.storage.from("materiais").createSignedUrl(path, 60 * 60 * 24 * 365);
          await supabase.from("materials").insert({
            lesson_id: aula.id,
            title: arquivo.name,
            file_url: signed?.signedUrl ?? path,
          });
        }
      }

      toast.success("Aula publicada com sucesso");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar a aula");
    } finally {
      setEnviando(false);
      setEtapa("");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!isAdmin) {
    return (
      <div className="panel p-6">
        <h1 className="font-display text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">Esta área é exclusiva do professor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.25em] text-accent">ADMINISTRAÇÃO</p>
        <h1 className="mt-2 text-3xl font-bold">Nova videoaula</h1>
      </header>

      <form onSubmit={enviar} className="panel space-y-4 p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Título</label>
          <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Módulo</label>
          <select required value={moduloId} onChange={(e) => setModuloId(e.target.value)} className={campo}>
            <option value="">Selecione...</option>
            {(modulos ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Descrição</label>
          <textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} className={campo} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Vídeo</label>
          <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} className={campo} />
          <p className="mt-1 text-xs text-muted-foreground">O arquivo vai para o armazenamento seguro, não para o banco.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">PDF da aula</label>
          <input type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} className={campo} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Materiais complementares</label>
          <input type="file" multiple onChange={(e) => setMateriais(e.target.files)} className={campo} />
        </div>
        <button
          disabled={enviando}
          className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {enviando ? etapa || "Enviando..." : "Publicar aula"}
        </button>
      </form>
    </div>
  );
}
