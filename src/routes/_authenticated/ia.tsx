import { createFileRoute } from "@tanstack/react-router";
import { AssistenteIA } from "@/components/AssistenteIA";

export const Route = createFileRoute("/_authenticated/ia")({
  head: () => ({
    meta: [
      { title: "IA do Jhon — Informática com Jhon" },
      { name: "description", content: "Tire dúvidas de Informática para concursos com o assistente de IA." },
      { property: "og:title", content: "IA do Jhon — Informática com Jhon" },
      { property: "og:description", content: "Explicações, resumos e simulados gerados por IA." },
    ],
  }),
  component: IAPage,
});

function IAPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.25em] text-accent">INTELIGÊNCIA ARTIFICIAL</p>
        <h1 className="mt-2 text-3xl font-bold">IA do Jhon</h1>
        <p className="mt-1 text-muted-foreground">Seu monitor de plantão para Informática em concursos.</p>
      </header>
      <div className="panel p-6">
        <AssistenteIA />
      </div>
    </div>
  );
}
