import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProgressBar } from "@/components/ProgressBar";

export const Route = createFileRoute("/_authenticated/curso/")({
  head: () => ({
    meta: [
      { title: "Curso completo — Informática com Jhon" },
      { name: "description", content: "Todos os módulos e aulas do curso de Informática para concursos." },
      { property: "og:title", content: "Curso completo — Informática com Jhon" },
      { property: "og:description", content: "Módulos de hardware, sistemas operacionais e redes." },
    ],
  }),
  component: CursoPage,
});

function CursoPage() {
  const { data } = useQuery({
    queryKey: ["curso"],
    queryFn: async () => {
      const [modules, lessons, progress] = await Promise.all([
        supabase.from("modules").select("*").order("position"),
        supabase.from("lessons").select("id, module_id, title, position").order("position"),
        supabase.from("lesson_progress").select("lesson_id, completed"),
      ]);
      return {
        modules: modules.data ?? [],
        lessons: lessons.data ?? [],
        progress: progress.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.25em] text-accent">TRILHA DE ESTUDO</p>
        <h1 className="mt-2 text-3xl font-bold">Informática para Concursos</h1>
        <p className="mt-1 text-muted-foreground">Estude na ordem dos módulos para fixar o conteúdo.</p>
      </header>

      <div className="space-y-4">
        {(data?.modules ?? []).map((m, i) => {
          const aulas = (data?.lessons ?? []).filter((l) => l.module_id === m.id);
          const feitas = aulas.filter((l) =>
            (data?.progress ?? []).some((p) => p.lesson_id === l.id && p.completed),
          ).length;
          const pct = aulas.length ? Math.round((feitas / aulas.length) * 100) : 0;
          return (
            <Link
              key={m.id}
              to="/curso/modulo/$moduloId"
              params={{ moduloId: m.id }}
              className="panel block p-6 transition-colors hover:border-primary"
            >
              <p className="text-[11px] tracking-widest text-muted-foreground">
                MÓDULO {String(i + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold">{m.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
              <ProgressBar value={pct} className="mt-4" />
              <p className="mt-2 text-xs text-muted-foreground">
                {aulas.length} aulas · {pct}% concluído
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
