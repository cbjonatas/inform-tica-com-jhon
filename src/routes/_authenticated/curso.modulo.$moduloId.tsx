import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProgressBar } from "@/components/ProgressBar";

export const Route = createFileRoute("/_authenticated/curso/modulo/$moduloId")({
  head: () => ({
    meta: [
      { title: "Módulo do curso — Informática com Jhon" },
      { name: "description", content: "Aulas e progresso do módulo selecionado." },
      { property: "og:title", content: "Módulo do curso — Informática com Jhon" },
      { property: "og:description", content: "Veja as aulas e seu progresso neste módulo." },
    ],
  }),
  component: ModuloPage,
});

function ModuloPage() {
  const { moduloId } = Route.useParams();

  const { data } = useQuery({
    queryKey: ["modulo", moduloId],
    queryFn: async () => {
      const [modulo, lessons, progress] = await Promise.all([
        supabase.from("modules").select("*").eq("id", moduloId).maybeSingle(),
        supabase.from("lessons").select("*").eq("module_id", moduloId).order("position"),
        supabase.from("lesson_progress").select("lesson_id, completed"),
      ]);
      return {
        modulo: modulo.data,
        lessons: lessons.data ?? [],
        progress: progress.data ?? [],
      };
    },
  });

  const aulas = data?.lessons ?? [];
  const feitas = aulas.filter((l) =>
    (data?.progress ?? []).some((p) => p.lesson_id === l.id && p.completed),
  ).length;
  const pct = aulas.length ? Math.round((feitas / aulas.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="panel p-6">
        <p className="text-[11px] tracking-widest text-muted-foreground">MÓDULO</p>
        <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">{data?.modulo?.title ?? "Carregando..."}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{data?.modulo?.description}</p>
        <ProgressBar value={pct} className="mt-4" />
        <p className="mt-2 text-xs text-muted-foreground">{pct}% concluído · {aulas.length} aulas</p>
      </header>

      <div className="space-y-2">
        {aulas.map((aula, i) => {
          const concluida = (data?.progress ?? []).some((p) => p.lesson_id === aula.id && p.completed);
          return (
            <Link
              key={aula.id}
              to="/curso/aula/$aulaId"
              params={{ aulaId: aula.id }}
              className="panel flex items-center gap-4 p-4 transition-colors hover:border-primary"
            >
              {concluida ? (
                <CheckCircle2 className="size-5 shrink-0 text-success" />
              ) : (
                <Circle className="size-5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="text-[11px] tracking-widest text-muted-foreground">
                  AULA {String(i + 1).padStart(2, "0")}
                </p>
                <p className="truncate font-medium">{aula.title}</p>
              </div>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {concluida ? "Concluída" : "Não concluída"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
