import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Play } from "lucide-react";

export interface LessonCardProps {
  id: string;
  title: string;
  subject?: string | null;
  part?: string | null;
  coverUrl?: string | null;
  durationSeconds?: number | null;
  completed?: boolean;
  positionSeconds?: number;
  position?: number;
}

export function LessonCard({
  id,
  title,
  subject,
  part,
  coverUrl,
  durationSeconds,
  completed = false,
  positionSeconds = 0,
  position,
}: LessonCardProps) {
  // Determinar a capa vertical (com fallback garantido)
  const finalCover = coverUrl && coverUrl.trim().length > 0 ? coverUrl : "/images/capa-padrao.png";

  // Identificar parte e assunto se não fornecidos explicitamente
  let displaySubject = subject;
  let displayPart = part;

  if (!displaySubject || !displayPart) {
    if (title.includes(" — ")) {
      const parts = title.split(" — ");
      displaySubject = displaySubject || parts[0];
      displayPart = displayPart || parts[1];
    } else if (title.includes(" - ")) {
      const parts = title.split(" - ");
      displaySubject = displaySubject || parts[0];
      displayPart = displayPart || parts[1];
    }
  }

  // Formatação de duração (ex: 35 min)
  const durationMinutes = durationSeconds && durationSeconds > 0 
    ? Math.round(durationSeconds / 60) 
    : null;

  // Cálculo da porcentagem assistida
  const progressPct = completed
    ? 100
    : durationSeconds && durationSeconds > 0 && positionSeconds > 0
    ? Math.min(99, Math.round((positionSeconds / durationSeconds) * 100))
    : 0;

  return (
    <Link
      to="/curso/aula/$aulaId"
      params={{ aulaId: id }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-[#0c0e12] shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-blue-950/30"
    >
      {/* Área da Imagem / Poster Vertical da Aula (aspect-[9/13]) */}
      <div className="relative aspect-[9/13] w-full overflow-hidden bg-zinc-900">
        <img
          src={finalCover}
          alt={title}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/images/capa-padrao.png";
          }}
          loading="lazy"
        />

        {/* Gradiente cinematográfico */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40 pointer-events-none" />

        {/* Badge Superior Esquerda: Parte do Assunto / Posição */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white tracking-tight backdrop-blur-md shadow-md">
          {displayPart ? (
            <span className="text-blue-400 font-bold">{displayPart}</span>
          ) : position ? (
            <span>Aula {position}</span>
          ) : (
            <span>Vídeo Aula</span>
          )}
        </div>

        {/* Badge Superior Direita: Concluída ou Duração */}
        <div className="absolute top-3 right-3 z-10">
          {completed ? (
            <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 backdrop-blur-md">
              <CheckCircle2 className="size-3" />
              <span>Concluída</span>
            </div>
          ) : durationMinutes ? (
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] font-medium text-zinc-300 backdrop-blur-md">
              <Clock className="size-2.5" />
              <span>{durationMinutes} min</span>
            </div>
          ) : null}
        </div>

        {/* Botão de Play Azul com Ícone Preto (Canto Inferior Direito) */}
        <div className="absolute right-3 bottom-3 z-10 flex size-10 items-center justify-center rounded-full bg-[#2563eb] text-black shadow-lg shadow-blue-600/40 transition-transform duration-200 group-hover:scale-110">
          <Play className="size-4 fill-black text-black ml-0.5" />
        </div>
      </div>

      {/* Rodapé do Card da Aula */}
      <div className="flex flex-1 flex-col justify-between space-y-2.5 p-4 pt-3 bg-[#0c0e12]">
        <div>
          {displaySubject && displaySubject !== title && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent truncate block">
              {displaySubject}
            </span>
          )}
          <h3 className="line-clamp-2 text-xs font-bold text-white transition-colors group-hover:text-blue-400 md:text-sm">
            {title}
          </h3>
        </div>

        {/* Barra de Progresso da Aula */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>{completed ? "Aula concluída" : progressPct > 0 ? "Em andamento" : "Não iniciada"}</span>
            <span className={completed ? "text-emerald-400 font-bold" : "text-blue-400 font-bold"}>
              {progressPct}%
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                completed ? "bg-emerald-500" : "bg-[#2563eb]"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default LessonCard;
