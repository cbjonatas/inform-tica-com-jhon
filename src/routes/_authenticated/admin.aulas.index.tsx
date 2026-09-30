import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Copy,
  Edit,
  Eye,
  EyeOff,
  Folder,
  PlusCircle,
  Trash2,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/aulas/")({
  head: () => ({
    meta: [
      { title: "Gerenciar Aulas — Painel do Professor" },
      { name: "description", content: "Gerenciamento completo de videoaulas: criar, editar, duplicar e publicar." },
    ],
  }),
  component: AdminAulasIndexPage,
});

function AdminAulasIndexPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin_all_lessons"],
    enabled: isAdmin,
    queryFn: async () => {
      const [modRes, lesRes] = await Promise.all([
        supabase.from("modules").select("id, title, position").order("position"),
        supabase.from("lessons").select("*, modules(title)").order("position"),
      ]);
      return {
        modules: modRes.data ?? [],
        lessons: lesRes.data ?? [],
      };
    },
  });

  const modules = data?.modules ?? [];
  const lessons = data?.lessons ?? [];

  // Toggle publicar / despublicar
  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      await supabase.from("lessons").update({ published: !published }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_all_lessons"] });
      setFeedback("Status de publicação atualizado!");
      setTimeout(() => setFeedback(null), 2500);
    },
  });

  // Duplicar aula
  const duplicateMutation = useMutation({
    mutationFn: async (lesson: any) => {
      const { id, created_at, modules, ...rest } = lesson;
      const nextPos = lesson.position + 1;
      await supabase.from("lessons").insert({
        ...rest,
        title: `${lesson.title} (Cópia)`,
        position: nextPos,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_all_lessons"] });
      setFeedback("Aula duplicada com sucesso!");
      setTimeout(() => setFeedback(null), 2500);
    },
  });

  // Excluir aula
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm("Tem certeza que deseja excluir esta aula permanentemente?")) return;
      await supabase.from("lessons").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_all_lessons"] });
      setFeedback("Aula excluída.");
      setTimeout(() => setFeedback(null), 2500);
    },
  });

  // Reordenar
  const reorderMutation = useMutation({
    mutationFn: async ({ id, newPosition }: { id: string; newPosition: number }) => {
      await supabase.from("lessons").update({ position: newPosition }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_all_lessons"] });
    },
  });

  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center space-y-4 max-w-md mx-auto my-12">
        <h2 className="text-xl font-bold font-display">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground">Esta página é restrita a administradores.</p>
        <Link to="/dashboard" className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Voltar
        </Link>
      </div>
    );
  }

  const filteredLessons = lessons.filter((l) => {
    if (selectedModule === "all") return true;
    return l.module_id === selectedModule;
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Voltar ao painel do professor
          </Link>
          <h1 className="mt-2 text-3xl font-bold font-display">Gerenciamento de Aulas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle de publicação, duplicação, reordenação e edição de todas as videoaulas do curso.
          </p>
        </div>

        <Link
          to="/admin/aulas/nova"
          className="glow-primary inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground self-start sm:self-auto"
        >
          <PlusCircle className="size-4" /> Nova Videoaula
        </Link>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-500">
          {feedback}
        </div>
      )}

      {/* Filtro por Módulo */}
      <div className="panel p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Folder className="size-4" />
          <span>Filtrar por Módulo:</span>
        </div>

        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
        >
          <option value="all">Todos os Módulos ({lessons.length} aulas)</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>

      {/* Lista de Aulas com CRUD */}
      <div className="space-y-3">
        {filteredLessons.map((aula) => (
          <div
            key={aula.id}
            className={cn(
              "panel flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-5 transition-all border",
              !aula.published && "opacity-60 bg-secondary/10"
            )}
          >
            <div className="flex items-start gap-3.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary font-mono text-xs font-bold text-muted-foreground">
                #{aula.position}
              </span>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                    {aula.modules?.title || "Módulo"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      aula.published
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-amber-500/10 text-amber-500"
                    )}
                  >
                    {aula.published ? "Publicada" : "Oculta (Rascunho)"}
                  </span>
                </div>

                <h3 className="font-semibold text-foreground text-base mt-0.5">{aula.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {aula.description || "Sem descrição"}
                </p>
              </div>
            </div>

            {/* Ações do Professor: Publicar, Duplicar, Reordenar, Excluir */}
            <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
              {/* Botões de Posição */}
              <button
                onClick={() =>
                  reorderMutation.mutate({ id: aula.id, newPosition: Math.max(1, aula.position - 1) })
                }
                disabled={aula.position <= 1}
                className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Mover para cima"
              >
                ▲
              </button>
              <button
                onClick={() =>
                  reorderMutation.mutate({ id: aula.id, newPosition: aula.position + 1 })
                }
                className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                title="Mover para baixo"
              >
                ▼
              </button>

              {/* Publicar / Despublicar */}
              <button
                onClick={() => togglePublishMutation.mutate({ id: aula.id, published: aula.published })}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  aula.published
                    ? "border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                    : "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                )}
                title={aula.published ? "Despublicar aula" : "Publicar aula"}
              >
                {aula.published ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {aula.published ? "Ocultar" : "Publicar"}
              </button>

              {/* Duplicar Aula */}
              <button
                onClick={() => duplicateMutation.mutate(aula)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                title="Duplicar aula"
              >
                <Copy className="size-3.5" /> Duplicar
              </button>

              {/* Ver Aula como Aluno */}
              <Link
                to="/curso/aula/$aulaId"
                params={{ aulaId: aula.id }}
                className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
              >
                <Video className="size-3.5" /> Ver aula
              </Link>

              {/* Excluir */}
              <button
                onClick={() => deleteMutation.mutate(aula.id)}
                className="p-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors"
                title="Excluir aula"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredLessons.length === 0 && !isLoading && (
          <div className="panel p-12 text-center text-muted-foreground text-sm">
            Nenhuma aula encontrada para o filtro selecionado.
          </div>
        )}
      </div>
    </div>
  );
}
