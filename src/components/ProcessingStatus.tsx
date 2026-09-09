import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  HelpCircle,
  Loader2,
  RefreshCcw,
  Sparkles,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProcessingStep =
  | "idle"
  | "processing_pdf"
  | "processing_video"
  | "generating_transcript"
  | "generating_summary"
  | "generating_questions"
  | "completed"
  | "error";

interface ProcessingStatusProps {
  currentStep: ProcessingStep;
  progressPercent?: number;
  errorMessage?: string;
  onRetry?: () => void;
  className?: string;
}

const STEP_LABELS: Record<ProcessingStep, { label: string; icon: any }> = {
  idle: { label: "Aguardando início...", icon: Loader2 },
  processing_pdf: { label: "PROCESSANDO PDF...", icon: FileText },
  processing_video: { label: "PROCESSANDO VÍDEO...", icon: Video },
  generating_transcript: { label: "GERANDO TRANSCRIÇÃO...", icon: FileText },
  generating_summary: { label: "GERANDO RESUMO...", icon: Sparkles },
  generating_questions: { label: "GERANDO QUESTÕES...", icon: HelpCircle },
  completed: { label: "✓ Processamento concluído", icon: CheckCircle2 },
  error: { label: "⚠ Não foi possível processar o arquivo.", icon: AlertTriangle },
};

export function ProcessingStatus({
  currentStep,
  progressPercent = 0,
  errorMessage,
  onRetry,
  className,
}: ProcessingStatusProps) {
  if (currentStep === "idle") return null;

  const isError = currentStep === "error";
  const isCompleted = currentStep === "completed";
  const config = STEP_LABELS[currentStep] || STEP_LABELS.idle;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-all shadow-sm",
        isError
          ? "border-red-500/40 bg-red-500/10 text-red-500"
          : isCompleted
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
          : "border-primary/30 bg-primary/5 text-foreground",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl",
              isError
                ? "bg-red-500/20 text-red-500"
                : isCompleted
                ? "bg-emerald-500/20 text-emerald-500"
                : "bg-primary/20 text-primary"
            )}
          >
            {isError ? (
              <AlertTriangle className="size-5" />
            ) : isCompleted ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <Loader2 className="size-5 animate-spin" />
            )}
          </div>

          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-wider">{config.label}</p>
            {isError && errorMessage && (
              <p className="mt-1 text-xs text-red-400 font-sans">{errorMessage}</p>
            )}
            {!isError && !isCompleted && (
              <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                O pipeline de Inteligência Artificial está estruturando o conteúdo da aula.
              </p>
            )}
          </div>
        </div>

        {/* Botão de Tentar Novamente em caso de erro */}
        {isError && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-xl bg-red-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-red-600 transition-colors"
          >
            <RefreshCcw className="size-3.5" /> Tentar novamente
          </button>
        )}

        {/* Porcentagem */}
        {!isError && (
          <span className="font-mono text-xs font-bold text-primary">{progressPercent}%</span>
        )}
      </div>

      {/* Barra de Progresso visual */}
      {!isError && (
        <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-secondary/80">
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              isCompleted ? "bg-emerald-500" : "bg-primary"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
