import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Painel do professor — Informática com Jhon" },
      { name: "description", content: "Crie, edite, reordene e exclua módulos e aulas do curso." },
      { property: "og:title", content: "Painel do professor — Informática com Jhon" },
      { property: "og:description", content: "Gestão de módulos e aulas da plataforma." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [novoModulo, setNovoModulo] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-curso"],
    enabled: isAdmin,
    queryFn: async () => {
      const [modules, lessons] = await Promise.all([
        supabase.from("modules").select("*").order("position"),
        supabase.from("lessons").select("*").order("position"),
      ]);
      return { modules: modules.data ?? [], lessons: lessons.data ?? [] };
    },
  });

  const recarregar = () => qc.invalidateQueries({ queryKey: ["admin-curso"] });

  const criarModulo = useMutation({
    mutationFn: async () => {
      const pos = (data?.modules.length ?? 0) + 1;
      const { error } = await supabase.from("modules").insert({ title: novoModulo, position: pos });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovoModulo("");
      toast.success("Módulo criado");
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mover = async (tabela: "modules" | "lessons", id: string, atual: number, delta: number) => {
    const { error } = await supabase.from(tabela).update({ position: atual + delta }).eq("id", id);
    if (error) toast.error(error.message);
    else void recarregar();
  };

  const excluir = async (tabela: "modules" | "lessons", id: string) => {
    const { error } = await supabase.from(tabela).delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Excluído");
      void recarregar();
    }
  };

  const renomear = async (tabela: "modules" | "lessons", id: string, title: string) => {
    const { error } = await supabase.from(tabela).update({ title }).eq("id", id);
    if (error) toast.error(error.message);
    else void recarregar();
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-accent">ADMINISTRAÇÃO</p>
          <h1 className="mt-2 text-3xl font-bold">Painel do professor</h1>
        </div>
        <Link to="/admin/aulas/nova" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          Nova aula
        </Link>
      </header>

      <div className="panel flex flex-wrap gap-2 p-4">
        <input
          value={novoModulo}
          onChange={(e) => setNovoModulo(e.target.value)}
          placeholder="Título do novo módulo"
          className="flex-1 rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          disabled={!novoModulo.trim() || criarModulo.isPending}
          onClick={() => criarModulo.mutate()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Plus className="size-4" /> Criar módulo
        </button>
      </div>

      <div className="space-y-4">
        {(data?.modules ?? []).map((m) => (
          <div key={m.id} className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                defaultValue={m.title}
                onBlur={(e) => void renomear("modules", m.id, e.target.value)}
                className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-lg font-semibold hover:border-border focus:border-primary focus:outline-none"
              />
              <button onClick={() => void mover("modules", m.id, m.position, -1)} aria-label="Subir módulo">
                <ArrowUp className="size-4 text-muted-foreground" />
              </button>
              <button onClick={() => void mover("modules", m.id, m.position, 1)} aria-label="Descer módulo">
                <ArrowDown className="size-4 text-muted-foreground" />
              </button>
              <button onClick={() => void excluir("modules", m.id)} aria-label="Excluir módulo">
                <Trash2 className="size-4 text-destructive" />
              </button>
            </div>

            <div className="mt-3 space-y-1.5">
              {(data?.lessons ?? [])
                .filter((l) => l.module_id === m.id)
                .map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <input
                      defaultValue={l.title}
                      onBlur={(e) => void renomear("lessons", l.id, e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none"
                    />
                    <button onClick={() => void mover("lessons", l.id, l.position, -1)} aria-label="Subir aula">
                      <ArrowUp className="size-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => void mover("lessons", l.id, l.position, 1)} aria-label="Descer aula">
                      <ArrowDown className="size-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => void excluir("lessons", l.id)} aria-label="Excluir aula">
                      <Trash2 className="size-4 text-destructive" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
