import { useState } from "react";
import { Download, ExternalLink, Eye, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PdfViewerProps {
  title: string;
  pdfUrl: string;
  subtitle?: string;
  allowDownload?: boolean;
  className?: string;
}

export function PdfViewer({
  title,
  pdfUrl,
  subtitle,
  allowDownload = true,
  className,
}: PdfViewerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className={cn("panel p-4 flex items-center justify-between transition-colors hover:border-primary", className)}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          title="Visualizar documento"
        >
          <Eye className="size-3.5" /> Visualizar
        </button>

        {allowDownload && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            title="Baixar arquivo"
          >
            <Download className="size-3.5" /> Baixar
          </a>
        )}
      </div>

      {/* Modal de visualização do PDF */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="size-4 text-primary" />
                <span className="text-sm font-bold truncate">{title}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mr-2"
                >
                  <ExternalLink className="size-3.5" /> Abrir em nova aba
                </a>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-secondary/10 p-2">
              <iframe
                src={`${pdfUrl}#toolbar=1`}
                className="size-full rounded-xl border border-border bg-white"
                title={title}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
