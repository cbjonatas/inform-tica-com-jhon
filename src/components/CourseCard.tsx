import { Link } from "@tanstack/react-router";
import { GraduationCap, Play } from "lucide-react";

export interface CourseCardProps {
  id: string;
  title: string;
  coverUrl?: string | null;
  lessonsCount?: number;
  pct?: number;
  category?: string;
  description?: string;
}

export function CourseCard({
  id,
  title,
  coverUrl,
  lessonsCount = 0,
  pct = 0,
}: CourseCardProps) {
  const hasCover = Boolean(coverUrl && coverUrl.trim().length > 0);

  return (
    <Link
      to={"/curso" as any}
      search={{ cursoId: id } as any}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-[#0c0e12] shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:shadow-blue-950/20"
    >
      {/* Área da Imagem / Poster Vertical */}
      <div className="relative aspect-[9/13] w-full overflow-hidden bg-zinc-900">
        {hasCover ? (
          <img
            key={coverUrl}
            src={coverUrl!}
            alt={title}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-[#0c0e12] to-zinc-950 p-4 text-center">
            <GraduationCap className="size-12 text-primary/40 mb-2 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-xs font-semibold text-zinc-400 line-clamp-2">{title}</span>
          </div>
        )}

        {/* Gradiente sutil para garantir contraste nos cantos */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

        {/* Badge de Quantidade de Aulas (Topo Esquerdo) */}
        <div className="absolute top-3 left-3 z-10 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-semibold text-white tracking-tight backdrop-blur-md shadow-md">
          {lessonsCount} {lessonsCount === 1 ? "Aula" : "Aulas"}
        </div>

        {/* Botão de Play Azul com Ícone Preto (Canto Inferior Direito) */}
        <div className="absolute right-3 bottom-3 z-10 flex size-10 items-center justify-center rounded-full bg-[#2563eb] text-black shadow-lg shadow-blue-600/40 transition-transform duration-200 group-hover:scale-110">
          <Play className="size-4 fill-black text-black ml-0.5" />
        </div>
      </div>

      {/* Rodapé do Card: Título e Progresso */}
      <div className="space-y-2 p-4 pt-3.5 bg-[#0c0e12]">
        {/* Título do Curso */}
        <h3 className="truncate text-sm font-bold text-white transition-colors group-hover:text-blue-400 md:text-base">
          {title}
        </h3>

        {/* Barra de Progresso do Curso */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>Progresso</span>
            <span className="font-semibold text-white">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
