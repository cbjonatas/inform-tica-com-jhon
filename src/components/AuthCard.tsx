import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AuthCard({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">
            IJ
          </span>
          <span className="leading-tight">
            <span className="block font-display text-sm font-bold">INFORMÁTICA COM JHON</span>
            <span className="block text-[11px] tracking-widest text-muted-foreground">PARA CONCURSOS</span>
          </span>
        </Link>
        <div className="panel p-6 md:p-8">
          <h1 className="font-display text-2xl font-bold">{titulo}</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">{subtitulo}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
