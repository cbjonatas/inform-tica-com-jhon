import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, Clock, Play, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProgressBar } from "@/components/ProgressBar";

export const Route = createFileRoute("/_authenticated/curso/modulo/$moduloId")({
  head: () => ({
    meta: [
      { title: "Módulo do Curso — Informática com Jhon" },
      { name: "description", content: "Acompanhe as aulas e seu progresso neste módulo." },
    ],
  }),
  component: ModuloDetailPage,
});

function ModuloDetailPage() {
  const { moduloId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["modulo", moduloId],
    queryFn: async () => {
      const [modRes, lessonsRes, progressRes] = await Promise.all([
        supabase.from("modules").select("*").eq("id", moduloId).maybeSingle(),
        supabase.from("lessons").select("*").eq("module_id", moduloId).order("position"),
        supabase.from("lesson_progress").select("lesson_id, completed, position_seconds"),
      ]);

      return {
        module: modRes.data,
        lessons: lessonsRes.data ?? [],
        progress: progressRes.data ?? [],
      };
    },
  });

  const module = data?.module;
  const lessons = data?.lessons ?? [];
  const progress = data?.progress ?? [];

  const concluidasCount = lessons.filter((l) =>
    progress.some((p) => p.lesson_id === l.id && p.completed)
  ).length;

  const pct = lessons.length ? Math.round((concluidasCount / lessons.length) * 100) : 0;

  // Próxima aula não concluída ou a primeira
  const proximaAula =
    lessons.find((l) => !progress.some((p) => p.lesson_id === l.id && p.completed)) ??
    lessons[0];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando módulo...</p>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="panel p-8 text-center space-y-4">
        <p className="text-lg font-semibold">Módulo não encontrado.</p>
        <Link
          to="/curso"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="size-4" /> Voltar para os módulos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Navegação de retorno */}
      <Link
        to="/curso"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar para todos os módulos
      </Link>

      {/* Cabeçalho do Módulo */}
      <header className="panel p-6 md:p-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">
              Módulo {String(module.position).padStart(2, "0")}
            </p>
            <h1 className="text-2xl font-bold md:text-3xl font-display">{module.title}</h1>
            <p className="text-muted-foreground leading-relaxed">
              {module.description || "Nenhuma descrição fornecida para este módulo."}
            </p>
          </div>

          {proximaAula && (
            <Link
              to="/curso/aula/$aulaId"
              params={{ aulaId: proximaAula.id }}
              className="glow-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              <Play className="size-4 fill-current" />
              {concluidasCount > 0 ? "CONTINUAR MÓDULO" : "INICIAR MÓDULO"}
            </Link>
          )}
        </div>

        {/* Barra de Progresso */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-muted-foreground">Progresso de conclusão</span>
            <span className="font-bold text-primary">{pct}%</span>
          </div>
          <ProgressBar value={pct} className="mt-2.5 h-2.5" />
          <p className="mt-2 text-xs text-muted-foreground">
            {concluidasCount} de {lessons.length} aulas concluídas
          </p>
        </div>
      </header>

      {/* Lista de Aulas */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold font-display flex items-center gap-2">
            <BookOpen className="size-5 text-primary" /> Conteúdo do Módulo
          </h2>
          <span className="text-xs text-muted-foreground">{lessons.length} aulas disponíveis</span>
        </div>

        <div className="space-y-3">
          {lessons.map((aula, index) => {
            const userProg = progress.find((p) => p.lesson_id === aula.id);
            const isCompleted = Boolean(userProg?.completed);

            return (
              <Link
                key={aula.id}
                to="/curso/aula/$aulaId"
                params={{ aulaId: aula.id }}
                className="panel block p-4 md:p-5 transition-all hover:border-primary hover:bg-secondary/20"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Status visual explícito: ✓ Concluída ou ○ Não concluída */}
                    {isCompleted ? (
                      <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                        <CheckCircle2 className="size-4" />
                        <span className="hidden sm:inline">Concluída</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        <Circle className="size-4" />
                        <span className="hidden sm:inline">Não concluída</span>
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Aula {String(index + 1).padStart(2, "0")}
                      </p>
                      <h3 className="font-medium text-foreground truncate text-base">
                        {aula.title}
                      </h3>
                      {aula.description && (
                        <p className="line-clamp-1 text-xs text-muted-foreground mt-0.5">
                          {aula.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {aula.duration_seconds > 0 && (
                      <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" />
                        {Math.round(aula.duration_seconds / 60)} min
                      </span>
                    )}
                    <span className="inline-flex size-8 items-center justify-center rounded-lg bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Play className="size-3.5 fill-current" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}

          {lessons.length === 0 && (
            <div className="panel p-8 text-center text-muted-foreground text-sm">
              Nenhuma aula cadastrada neste módulo ainda.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
