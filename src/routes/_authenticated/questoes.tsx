import { createFileRoute } from "@tanstack/react-router";
import { QuestionList } from "@/components/QuestionList";

export const Route = createFileRoute("/_authenticated/questoes")({
  head: () => ({
    meta: [
      { title: "Banco de questões — Informática com Jhon" },
      { name: "description", content: "Resolva questões de Informática para concursos e acompanhe seus acertos." },
      { property: "og:title", content: "Banco de questões — Informática com Jhon" },
      { property: "og:description", content: "Treine com questões comentadas de Informática." },
    ],
  }),
  component: QuestoesPage,
});

function QuestoesPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.25em] text-accent">TREINO</p>
        <h1 className="mt-2 text-3xl font-bold">Banco de questões</h1>
        <p className="mt-1 text-muted-foreground">Responda e veja o comentário na hora.</p>
      </header>
      <div className="panel p-6">
        <QuestionList />
      </div>
    </div>
  );
}
