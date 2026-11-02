import { useState } from "react";
import { CheckCircle2, RotateCcw, Star, Trash2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestionContent } from "@/components/QuestionContent";

export interface QuestionData {
  id: string;
  statement: string;
  options: string[];
  correct_index: number;
  explanation?: string;
  banca?: string;
  ano?: number;
  difficulty?: string;
  subject?: string;
}

interface QuestionCardProps {
  question: QuestionData;
  questionNumber?: number;
  userSelectedIndex?: number;
  onAnswer: (selectedIndex: number, isCorrect: boolean) => void;
  onRetry?: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  onDelete?: (questionId: string) => void;
  className?: string;
}

export function QuestionCard({
  question,
  questionNumber,
  userSelectedIndex,
  onAnswer,
  onRetry,
  isFavorited = false,
  onToggleFavorite,
  onDelete,
  className,
}: QuestionCardProps) {
  const [localSelection, setLocalSelection] = useState<number | undefined>(userSelectedIndex);

  const selectedIdx = userSelectedIndex !== undefined ? userSelectedIndex : localSelection;
  const hasAnswered = selectedIdx !== undefined;
  const isCorrect = selectedIdx === question.correct_index;

  const handleSelect = (idx: number) => {
    if (hasAnswered) return;
    setLocalSelection(idx);
    onAnswer(idx, idx === question.correct_index);
  };

  const handleRetryInternal = () => {
    setLocalSelection(undefined);
    onRetry?.();
  };

  const options = Array.isArray(question.options) ? question.options : [];

  return (
    <div className={cn("panel p-6 space-y-4 border border-border shadow-sm", className)}>
      {/* Cabeçalho da Questão */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-border/50 pb-3">
        <div className="flex items-center gap-2 font-bold">
          <span className="text-primary font-mono">
            {questionNumber ? `QUESTÃO ${String(questionNumber).padStart(2, "0")}` : "QUESTÃO"}
          </span>
          {question.banca && (
            <span className="rounded bg-secondary px-2 py-0.5 text-foreground font-mono">
              {question.banca}
            </span>
          )}
          {question.ano && <span className="text-muted-foreground">{question.ano}</span>}
          {question.difficulty && (
            <span className="rounded bg-accent/10 px-2 py-0.5 text-accent text-[10px] uppercase font-bold">
              {question.difficulty}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {question.subject && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline truncate max-w-xs">
              {question.subject}
            </span>
          )}
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className={cn(
                "p-1.5 rounded-lg transition-colors cursor-pointer",
                isFavorited ? "text-amber-400 bg-amber-400/10" : "text-muted-foreground hover:text-foreground"
              )}
              title={isFavorited ? "Remover dos favoritos" : "Salvar nos favoritos"}
            >
              <Star className={cn("size-4", isFavorited && "fill-current")} />
            </button>
          )}

          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm("Deseja realmente excluir esta questão da plataforma?")) {
                  onDelete(question.id);
                }
              }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              title="Excluir questão da plataforma"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Enunciado com suporte nativo a Imagens, Tabelas e Formatação */}
      <QuestionContent
        content={question.statement}
        className="text-base text-foreground leading-relaxed"
      />

      {/* Alternativas A a E */}
      <div className="space-y-2.5 pt-2">
        {options.map((opt, optIndex) => {
          const letter = String.fromCharCode(65 + optIndex);
          const isSelected = selectedIdx === optIndex;
          const isThisCorrect = optIndex === question.correct_index;

          let btnStyle = "border-border bg-secondary/20 hover:bg-secondary/60 cursor-pointer";
          if (hasAnswered) {
            btnStyle = "cursor-default";
            if (isThisCorrect) {
              btnStyle = "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 font-semibold cursor-default";
            } else if (isSelected) {
              btnStyle = "border-red-500/50 bg-red-500/10 text-red-500 line-through cursor-default";
            } else {
              btnStyle = "opacity-40 border-border cursor-default";
            }
          }

          return (
            <button
              key={optIndex}
              disabled={hasAnswered}
              onClick={() => handleSelect(optIndex)}
              className={cn(
                "flex w-full items-start gap-3.5 rounded-xl border p-3.5 text-left text-sm transition-all",
                btnStyle
              )}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary font-mono text-xs font-bold">
                {letter}
              </span>
              <div className="flex-1 leading-relaxed">
                <QuestionContent content={opt} className="text-sm" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Feedback e Gabarito Comentado */}
      {hasAnswered && (
        <div
          className={cn(
            "rounded-xl p-4 text-sm leading-relaxed border space-y-2 mt-4 animate-fadeIn",
            isCorrect ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              {isCorrect ? (
                <span className="text-emerald-500 flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> ✓ CORRETA
                </span>
              ) : (
                <span className="text-amber-500 flex items-center gap-1.5">
                  <XCircle className="size-4" /> ✗ INCORRETA
                </span>
              )}
              <span className="text-muted-foreground ml-2 text-xs">
                GABARITO: <strong>Letra {String.fromCharCode(65 + question.correct_index)}</strong>
              </span>
            </div>

            <button
              onClick={handleRetryInternal}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold cursor-pointer"
            >
              <RotateCcw className="size-3" /> Refazer questão
            </button>
          </div>

          {question.explanation && (
            <div className="text-xs md:text-sm text-muted-foreground pt-1.5 border-t border-border/50">
              <p className="font-semibold text-foreground uppercase text-[10px] tracking-wider mb-1">
                COMENTÁRIO DO PROFESSOR / IA:
              </p>
              <QuestionContent
                content={question.explanation}
                className="text-xs md:text-sm text-foreground/90 leading-relaxed"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
