import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, GraduationCap, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UploadArea } from "@/components/UploadArea";

export const Route = createFileRoute("/_authenticated/admin/cursos/novo")({
  head: () => ({
    meta: [
      { title: "Criar Novo Curso — Informática com Jhon" },
      { name: "description", content: "Cadastre um novo curso de informática para concursos na plataforma." },
    ],
  }),
  component: NovoCursoPage,
});

export function NovoCursoPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  // Campos do formulário (Item 2 da especificação)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [category, setCategory] = useState("Carreiras Policiais");
  const [status, setStatus] = useState<"draft" | "published">("published");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("O nome do curso é obrigatório.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase
        .from("courses")
        .insert({
          title: title.trim(),
          description: description.trim(),
          cover_url: coverUrl.trim() || "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80",
          category: category.trim(),
          status,
        })
        .select()
        .single();

      if (error) throw error;

      navigate({ to: "/admin/cursos" });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erro ao criar o curso. Verifique as permissões.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCoverUpload = (file: File) => {
    // Simulação ou upload real para storage
    const fakeUrl = URL.createObjectURL(file);
    setCoverUrl(fakeUrl);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Topo */}
      <div>
        <Link
          to="/admin/cursos"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" /> Voltar para Cursos
        </Link>
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/20 text-primary">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display">CRIAR NOVO CURSO</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Cadastre um novo curso de Informática para Concursos de forma totalmente dinâmica.
            </p>
          </div>
        </div>
      </div>

      {/* Formulário (Item 2) */}
      <form onSubmit={handleSubmit} className="panel p-6 md:p-8 space-y-6">
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500">
            {errorMsg}
          </div>
        )}

        {/* Nome do Curso */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Nome do Curso *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: INFORMÁTICA PARA PMBA, INFORMÁTICA PARA POLÍCIA FEDERAL..."
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        {/* Descrição */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Descrição do Curso
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva os objetivos, a banca e o foco das matérias deste curso..."
            className="w-full rounded-xl border border-border bg-background p-4 text-sm focus:border-primary focus:outline-none resize-none"
          />
        </div>

        {/* Imagem / Capa do Curso */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Imagem / Capa do Curso
          </label>
          <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
            <UploadArea
              accept={{ "image/*": [".jpg", ".jpeg", ".png", ".webp"] }}
              maxSizeMb={5}
              label="Arraste a imagem de capa ou clique para selecionar"
              sublabel="PNG, JPG ou WEBP até 5MB"
              onFileSelect={handleCoverUpload}
            />

            <div className="flex flex-col justify-between rounded-xl border border-border bg-secondary/20 p-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Ou cole uma URL da capa:</p>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              {coverUrl ? (
                <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-border bg-secondary">
                  <img src={coverUrl} alt="Preview da capa" className="size-full object-cover" />
                </div>
              ) : (
                <div className="mt-3 grid aspect-video w-full place-items-center rounded-lg border border-dashed border-border text-muted-foreground text-[11px]">
                  Prévia da capa
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
            >
              <option value="Carreiras Policiais">Carreiras Policiais</option>
              <option value="Carreiras Militares">Carreiras Militares</option>
              <option value="Carreiras Federais">Carreiras Federais</option>
              <option value="Carreiras Administrativas">Carreiras Administrativas</option>
              <option value="Tribunais e Ministérios Públicos">Tribunais e Ministérios Públicos</option>
              <option value="Conhecimentos Gerais">Conhecimentos Gerais</option>
            </select>
          </div>

          {/* Status (Rascunho / Publicado) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Status Inicial
            </label>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="draft"
                  checked={status === "draft"}
                  onChange={() => setStatus("draft")}
                  className="accent-primary"
                />
                <span>○ Rascunho</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="published"
                  checked={status === "published"}
                  onChange={() => setStatus("published")}
                  className="accent-primary"
                />
                <span className="font-semibold text-emerald-500">● Publicado</span>
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cursos em rascunho são visíveis apenas para a administração.
            </p>
          </div>
        </div>

        {/* Botão de Envio */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Link
            to="/admin/cursos"
            className="rounded-xl border border-border px-5 py-2.5 text-xs font-semibold hover:bg-secondary transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="glow-primary inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> CRIANDO CURSO...
              </>
            ) : (
              <>
                <GraduationCap className="size-4" /> CRIAR CURSO
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
export default NovoCursoPage;
