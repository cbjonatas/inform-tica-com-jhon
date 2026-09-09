import { useState, useRef } from "react";
import { AlertCircle, FileCheck, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadAreaProps {
  label: string;
  accept: string;
  maxSizeMB: number;
  fileTypeLabel: string;
  onFileSelected: (file: File | null) => void;
  selectedFile: File | null;
  className?: string;
}

export function UploadArea({
  label,
  accept,
  maxSizeMB,
  fileTypeLabel,
  onFileSelected,
  selectedFile,
  className,
}: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validateAndSelect = (file: File) => {
    setError(null);

    // Validação de tamanho
    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > maxSizeMB) {
      setError(`O arquivo selecionado (${sizeInMB.toFixed(1)}MB) excede o limite máximo permitido de ${maxSizeMB}MB.`);
      onFileSelected(null);
      return;
    }

    onFileSelected(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        <span className="text-[10px] text-muted-foreground">
          Limite: {maxSizeMB}MB ({fileTypeLabel})
        </span>
      </div>

      {!selectedFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all bg-secondary/10",
            isDragging
              ? "border-primary bg-primary/5 scale-[0.99]"
              : "border-border hover:border-primary hover:bg-secondary/20"
          )}
        >
          <UploadCloud className="size-8 text-muted-foreground mb-2" />
          <p className="text-xs font-semibold text-foreground">
            Clique para selecionar ou arraste o arquivo até aqui
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Suporta {fileTypeLabel} até {maxSizeMB}MB
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                validateAndSelect(e.target.files[0]);
              }
            }}
            className="hidden"
          />
        </div>
      ) : (
        <div className="panel flex items-center justify-between p-3.5 border border-emerald-500/30 bg-emerald-500/5 rounded-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <FileCheck className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onFileSelected(null)}
            className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
            title="Remover arquivo"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
