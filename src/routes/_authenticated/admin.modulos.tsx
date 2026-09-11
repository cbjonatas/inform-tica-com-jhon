import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Edit, FolderPlus, GraduationCap, GripVertical, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/modulos")({
  head: () => ({
    meta: [
      { title: "Gerenciar Módulos — Painel do Professor" },
      { name: "description", content: "Criar, editar e organizar módulos por curso de forma independente." },
    ],
  }),
  component: AdminModulosPage,
});

function AdminModulosPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // 1. Buscar todos os cursos
  const { data: courses = [] } = useQuery({
    queryKey: ["admin_courses_for_modules"],
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

  const activeCourseId = selectedCourseId || courses[0]?.id || "";

  // 2. Buscar módulos do curso ativo
  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["admin_modules", activeCourseId],
    enabled: isAdmin && Boolean(activeCourseId),
    queryFn: async () => {
      const res = await supabase
        .from("modules")
        .select("*")
        .eq("course_id", activeCourseId)
        .order("position");
      return res.data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !activeCourseId) return;

      if (editingId) {
        await supabase
          .from("modules")
          .update({
            title: title.trim(),
            description: description.trim(),
            course_id: activeCourseId,
          })
          .eq("id", editingId);
      } else {
        const nextPosition = modules.length > 0 ? Math.max(...modules.map((m) => m.position)) + 1 : 1;
        await supabase
          .from("modules")
          .insert({
            course_id: activeCourseId,
            title: title.trim(),
            description: description.trim(),
            position: nextPosition,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_modules"] });
      queryClient.invalidateQueries({ queryKey: ["curso-trilha"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-multicourse"] });
      setTitle("");
      setDescription("");
      setEditingId(null);
      setFeedback("Módulo salvo com sucesso no curso selecionado!");
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
      queryClient.invalidateQueries({ queryKey: ["curso-trilha"] });
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

  const currentCourse = courses.find((c) => c.id === activeCourseId);

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Voltar ao painel administrativo
          </Link>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold font-display">Gerenciar Módulos por Curso</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Organize a estrutura curricular de cada curso de forma totalmente isolada.
          </p>
        </div>

        {/* Seletor de Curso para os Módulos */}
        <div className="flex items-center gap-2">
          <GraduationCap className="size-4 text-primary" />
          <select
            value={activeCourseId}
            onChange={(e) => {
              setSelectedCourseId(e.target.value);
              setEditingId(null);
              setTitle("");
              setDescription("");
            }}
            className="rounded-xl border border-primary/50 bg-secondary/80 px-3 py-2 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
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
            {editingId ? "Editar Módulo" : `Cadastrar Novo Módulo em: ${currentCourse?.title || "Curso"}`}
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
          disabled={!title.trim() || saveMutation.isPending}
          className="glow-primary inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          <Plus className="size-4" />
          {editingId ? "Atualizar Módulo" : "Adicionar Módulo ao Curso"}
        </button>
      </form>

      {/* Lista de Módulos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold font-display">
            Módulos de {currentCourse?.title} ({modules.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="panel h-16 animate-pulse bg-secondary/30" />
            ))}
          </div>
        ) : modules.length === 0 ? (
          <div className="panel p-8 text-center text-muted-foreground text-xs">
            Nenhum módulo cadastrado para este curso ainda. Preencha o formulário acima para adicionar o primeiro módulo.
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((m, idx) => (
              <div
                key={m.id}
                className="panel flex items-center justify-between p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate text-foreground">{m.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{m.description || "Sem descrição"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingId(m.id);
                      setTitle(m.title);
                      setDescription(m.description || "");
                    }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Editar módulo"
                  >
                    <Edit className="size-4" />
                  </button>

                  <button
                    onClick={() => deleteMutation.mutate(m.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Excluir módulo"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default AdminModulosPage;
