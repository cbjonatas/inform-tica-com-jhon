export interface LessonContext {
  courseTitle?: string;
  moduleTitle?: string;
  lessonTitle: string;
  transcript?: string;
  pdfText?: string;
}

export interface GeneratedSummaryResult {
  resumo: string;
  conceitos: string[];
  pontos: string[];
  pegadinhas: string[];
  prova: string[];
}

export interface GeneratedQuestionItem {
  statement: string;
  options: string[];
  correct_index: number;
  explanation: string;
  banca: string;
  difficulty: "Fácil" | "Médio" | "Difícil";
  subject: string;
}

export interface PdfAnalysisResult {
  assuntos: string[];
  subassuntos: string[];
  conceitos: string[];
  termos: string[];
  pontosProva: string[];
}

export interface TranscriptionResult {
  transcript: string;
  timestamps: Array<{ time: number; label: string; text: string }>;
}
