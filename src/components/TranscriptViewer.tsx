import { useState } from "react";
import { CheckCircle2, Copy, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimestampSection {
  time: number;
  label: string;
  text?: string;
}

interface TranscriptViewerProps {
  timestamps: TimestampSection[];
  onSeek: (seconds: number) => void;
  status?: string;
  className?: string;
}

export function TranscriptViewer({
  timestamps,
  onSeek,
  status = "✓ Transcrição concluída",
  className,
}: TranscriptViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [copied, setCopied] = useState(false);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleCopy = () => {
    const fullContent = timestamps
      .map((t) => `[${formatTime(t.time)}] ${t.label}\n${t.text || ""}`)
      .join("\n\n");
    navigator.clipboard.writeText(fullContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = timestamps.filter((t) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return t.label.toLowerCase().includes(term) || (t.text && t.text.toLowerCase().includes(term));
  });

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header com Status e Barra de Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="size-3.5" /> {status}
          </span>
          <span className="text-muted-foreground">• Português Brasileiro</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar palavra na transcrição..."
              className="w-full rounded-xl border border-border bg-background pl-8 pr-3 py-1.5 text-xs focus:border-primary focus:outline-none"
            />
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-xl border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors shrink-0"
            title="Copiar texto completo"
          >
            <Copy className="size-3.5" />
            <span className="hidden sm:inline">{copied ? "Copiado!" : "Copiar"}</span>
          </button>
        </div>
      </div>

      {/* Lista de Trechos com Timestamps Clicáveis */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
        {filtered.map((item, idx) => (
          <div
            key={idx}
            onClick={() => onSeek(item.time)}
            className="panel flex items-start gap-3.5 p-3.5 cursor-pointer transition-all hover:border-primary hover:bg-secondary/30 group"
          >
            <span className="shrink-0 font-mono text-xs font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-md group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              {formatTime(item.time)}
            </span>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                {item.label}
              </p>
              {item.text && (
                <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Nenhum trecho corresponde à busca "{searchTerm}".
          </p>
        )}
      </div>
    </div>
  );
}
