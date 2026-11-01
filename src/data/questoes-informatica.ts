import rawQuestions from "./questoes-informatica.json";

export interface SeedQuestion {
  id: string;
  original_api_id: number;
  external_id: string;
  statement: string;
  options: string[];
  correct_index: number;
  explanation: string;
  banca: string;
  ano: number;
  difficulty: string;
  subject: string;
  subtopic: string;
  course_id?: string | null;
  module_id?: string | null;
  lesson_id?: string | null;
}

export const questoesInformatica: SeedQuestion[] = rawQuestions as SeedQuestion[];

export function getQuestoesByTopic(topic: string): SeedQuestion[] {
  return questoesInformatica.filter((q) =>
    q.subtopic.toLowerCase().includes(topic.toLowerCase())
  );
}

export function getQuestoesByBanca(banca: string): SeedQuestion[] {
  return questoesInformatica.filter(
    (q) => q.banca.toLowerCase() === banca.toLowerCase()
  );
}
