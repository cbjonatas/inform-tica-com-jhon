import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ProgressBar } from "@/components/ProgressBar";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard do aluno — Informática com Jhon" },
      { name: "description", content: "Acompanhe seu progresso, questões e retome a última aula assistida." },
      { property: "og:title", content: "Dashboard do aluno — Informática com Jhon" },
      { property: "og:description", content: "Seu painel de estudos de Informática para concursos." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, user } = useAuth();

  const { data } = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [modules, lessons, progress, attempts] = await Promise.all([
        supabase.from("modules").select("*").order("position"),
        supabase.from("lessons").select("id, title, module_id, position").order("position"),
        supabase
          .from("lesson_progress")
          .select("lesson_id, completed, position_seconds, updated_at")
          .order("updated_at", { ascending: false }),
        supabase.from("question_attempts").select("is_correct"),
      ]);
      return {
        modules: modules.data ?? [],
        lessons: lessons.data ?? [],
        progress: progress.data ?? [],
        attempts: attempts.data ?? [],
      };
    },
  });

  const lessons = data?.lessons ?? [];
  const progress = data?.progress ?? [];
  const attempts = data?.attempts ?? [];
  const concluidas = progress.filter((p) => p.completed).length;
  const pct = lessons.length ? Math.round((concluidas / lessons.length) * 100) : 0;
  const acertos = attempts.filter((a) => a.is_correct).length;
  const taxa = attempts.length ? Math.round((acertos / attempts.length) * 100) : 0;

  const ultimaAula =
    lessons.find((l) => l.id === progress[0]?.lesson_id) ?? lessons[0] ?? null;

  const primeiroNome = (profile?.full_name || "").split(" ")[0] || "aluno";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold tracking-[0.25em] text-accent">ÁREA DO ALUNO</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">Olá, {primeiroNome}!</h1>
        <p className="mt-1 text-muted-foreground">Continue sua preparação.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="panel flex flex-col justify-between gap-6 p-6">
          <div>
            <p className="text-[11px] tracking-widest text-muted-foreground">ÚLTIMA AULA ACESSADA</p>
            <h2 className="mt-2 font-display text-xl font-semibold md:text-2xl">
              {ultimaAula ? ultimaAula.title : "Comece pelo Módulo 01"}
            </h2>
          </div>
          {ultimaAula && (
            <Link
              to="/curso/aula/$aulaId"
              params={{ aulaId: ultimaAula.id }}
              className="glow-primary inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground"
            >
              <Play className="size-4" /> CONTINUAR ESTUDANDO
            </Link>
          )}
        </div>

        <div className="panel p-6">
          <p className="text-[11px] tracking-widest text-muted-foreground">PROGRESSO GERAL</p>
          <p className="mt-2 font-display text-4xl font-bold">{pct}%</p>
          <ProgressBar value={pct} className="mt-3" />
          <p className="mt-3 text-sm text-muted-foreground">
            {concluidas} de {lessons.length} aulas concluídas
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Questões respondidas", value: attempts.length },
          { label: "Percentual de acertos", value: `${taxa}%` },
          { label: "Questões erradas", value: attempts.length - acertos },
          { label: "Módulos", value: data?.modules.length ?? 0 },
        ].map((s) => (
          <div key={s.label} className="panel p-4">
            <p className="font-display text-2xl font-bold">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Módulos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(data?.modules ?? []).map((m) => {
            const aulasDoModulo = lessons.filter((l) => l.module_id === m.id);
            const feitas = aulasDoModulo.filter((l) =>
              progress.some((p) => p.lesson_id === l.id && p.completed),
            ).length;
            const p = aulasDoModulo.length ? Math.round((feitas / aulasDoModulo.length) * 100) : 0;
            return (
              <Link key={m.id} to="/curso/modulo/$moduloId" params={{ moduloId: m.id }} className="panel block p-5 transition-colors hover:border-primary">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold">{m.title}</h3>
                  <span className="text-sm text-primary">{p}%</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>
                <ProgressBar value={p} className="mt-3" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {feitas} de {aulasDoModulo.length} aulas concluídas
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <Link to="/ia" className="panel flex items-center gap-4 p-5 transition-colors hover:border-primary">
        <Sparkles className="size-6 text-accent" />
        <div>
          <p className="font-display font-semibold">Tire dúvidas com a IA do Jhon</p>
          <p className="text-sm text-muted-foreground">Explicações, resumos e questões sobre o conteúdo do curso.</p>
        </div>
      </Link>
    </div>
  );
}
