import { createFileRoute, Link } from "@tanstack/react-router";
import { Cpu, Network, ShieldCheck, Terminal } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Informática com Jhon para Concursos" },
      {
        name: "description",
        content:
          "Plataforma exclusiva de Informática para concursos públicos: videoaulas, PDFs, questões comentadas e tutor de IA.",
      },
      { property: "og:title", content: "Informática com Jhon para Concursos" },
      {
        property: "og:description",
        content: "Videoaulas, materiais e questões de Informática focadas em concursos públicos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const pilares = [
  { icon: Cpu, title: "Hardware e Software", text: "Do processador ao armazenamento, do jeito que a banca cobra." },
  { icon: Terminal, title: "Sistemas Operacionais", text: "Windows e Linux com atalhos, comandos e pegadinhas." },
  { icon: Network, title: "Redes e TCP/IP", text: "Topologias, protocolos e endereçamento sem enrolação." },
  { icon: ShieldCheck, title: "Segurança e Revisão", text: "Questões comentadas e revisão guiada por IA." },
];

function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">
            IJ
          </span>
          <span className="leading-tight">
            <span className="block font-display text-sm font-bold">INFORMÁTICA COM JHON</span>
            <span className="block text-[11px] tracking-widest text-muted-foreground">PARA CONCURSOS</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Criar conta
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 md:px-8 md:pt-20">
        <p className="text-xs font-semibold tracking-[0.25em] text-accent">PREPARAÇÃO FOCADA EM PROVA</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
          Informática para concursos, do zero ao gabarito.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground md:text-lg">
          Curso completo com videoaulas, transcrições, PDFs, questões comentadas e um tutor de inteligência
          artificial que responde suas dúvidas na hora do estudo.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/cadastro"
            className="glow-primary rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground"
          >
            Começar agora
          </Link>
          <Link to="/login" className="rounded-xl border border-border px-6 py-3 font-semibold">
            Já sou aluno
          </Link>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pilares.map((p) => (
            <div key={p.title} className="panel p-5">
              <p.icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-base font-semibold">{p.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
