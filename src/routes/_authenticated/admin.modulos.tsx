import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Edit, FolderPlus, GripVertical, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/modulos")({
  head: () => ({
    meta: [
      { title: "Gerenciar Módulos — Painel do Professor" },
      { name: "description", content: "Criar, editar e organizar módulos do curso." },
    ],
  }),
  component: AdminModulosPage,
});

function AdminModulosPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["admin_modules"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await supabase.from("modules").select("*").order("position");
      return res.data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) return;

      if (editingId) {
        await supabase
          .from("modules")
          .update({ title: title.trim(), description: description.trim() })
          .eq("id", editingId);
      } else {
        const nextPosition = modules.length > 0 ? Math.max(...modules.map((m) => m.position)) + 1 : 1;
        await supabase
          .from("modules")
          .insert({
            title: title.trim(),
            description: description.trim(),
            position: nextPosition,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_modules"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["curso"] });
      setTitle("");
      setDescription("");
      setEditingId(null);
      setFeedback("Módulo salvo com sucesso!");
      setTimeout(() => setFeedback(null), 3000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm("Tem certeza que deseja excluir este módulo e todas as suas aulas?")) return;
      await supabase.from("modules").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_modules"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["curso"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, newPosition }: { id: string; newPosition: number }) => {
      await supabase.from("modules").update({ position: newPosition }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_modules"] });
    },
  });

  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center space-y-4 max-w-md mx-auto my-12">
        <h2 className="text-xl font-bold font-display">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground">Esta área é restrita a administradores.</p>
        <Link to="/dashboard" className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao painel administrativo
        </Link>
        <h1 className="mt-2 text-3xl font-bold font-display">Gerenciar Módulos do Curso</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie novos tópicos e reordene os módulos sem precisar alterar o código.
        </p>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-500">
          {feedback}
        </div>
      )}

      {/* Formulário de Criação / Edição */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
        className="panel p-6 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold font-display flex items-center gap-2">
            <FolderPlus className="size-4 text-primary" />
            {editingId ? "Editar Módulo" : "Cadastrar Novo Módulo"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setTitle("");
                setDescription("");
              }}
              className="text-xs text-muted-foreground hover:underline"
            >
              Cancelar edição
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Título do Módulo
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Módulo 04 — Segurança da Informação"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Descrição (Foco em Concursos)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Principais malwares, criptografia, certificados digitais e políticas de backup."
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="glow-primary rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {editingId ? "Salvar Alterações" : "Criar Módulo"}
        </button>
      </form>

      {/* Lista de Módulos Existentes */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold font-display">Módulos Cadastrados ({modules.length})</h2>

        <div className="space-y-3">
          {modules.map((m, index) => (
            <div
              key={m.id}
              className="panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-5"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary font-mono text-xs font-bold text-muted-foreground">
                  {m.position}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground text-base">{m.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {/* Alterar posição rápida */}
                <button
                  onClick={() => reorderMutation.mutate({ id: m.id, newPosition: Math.max(1, m.position - 1) })}
                  disabled={m.position <= 1}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title="Mover para cima"
                >
                  ▲
                </button>
                <button
                  onClick={() => reorderMutation.mutate({ id: m.id, newPosition: m.position + 1 })}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  title="Mover para baixo"
                >
                  ▼
                </button>

                <button
                  onClick={() => {
                    setEditingId(m.id);
                    setTitle(m.title);
                    setDescription(m.description);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                >
                  <Edit className="size-3.5" /> Editar
                </button>

                <button
                  onClick={() => deleteMutation.mutate(m.id)}
                  className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20"
                >
                  <Trash2 className="size-3.5" /> Excluir
                </button>
              </div>
            </div>
          ))}

          {modules.length === 0 && !isLoading && (
            <div className="panel p-8 text-center text-sm text-muted-foreground">
              Nenhum módulo cadastrado ainda. Utilize o formulário acima para criar o primeiro módulo!
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
