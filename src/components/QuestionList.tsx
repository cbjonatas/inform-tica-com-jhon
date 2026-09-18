import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function QuestionList({ lessonId }: { lessonId?: string }) {
  const { user } = useAuth();
  const [respostas, setRespostas] = useState<Record<string, number>>({});

  const { data } = useQuery({
    queryKey: ["questoes", lessonId ?? "todas"],
    queryFn: async () => {
      let q = supabase.from("questions").select("*").order("created_at");
      if (lessonId) q = q.eq("lesson_id", lessonId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const responder = async (questaoId: string, index: number, correta: number) => {
    if (respostas[questaoId] !== undefined) return;
    setRespostas((r) => ({ ...r, [questaoId]: index }));
    if (!user) return;
    await supabase.from("question_attempts").insert({
      user_id: user.id,
      question_id: questaoId,
      selected_index: index,
      is_correct: index === correta,
    });
  };

  if (!data?.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma questão cadastrada ainda.</p>;
  }

  return (
    <div className="space-y-6">
      {data.map((q) => {
        const alternativas = (Array.isArray(q.options) ? q.options : []) as string[];
        const escolhida = respostas[q.id];
        const respondida = escolhida !== undefined;
        return (
          <div key={q.id} className="rounded-xl border border-border p-5">
            {(q.banca || q.ano) && (
              <p className="mb-2 text-[11px] tracking-widest text-muted-foreground">
                {[q.banca, q.ano].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-sm font-medium leading-relaxed">{q.statement}</p>
            <div className="mt-4 space-y-2">
              {alternativas.map((alt, i) => {
                const correta = i === q.correct_index;
                return (
                  <button
                    key={i}
                    onClick={() => void responder(q.id, i, q.correct_index)}
                    className={cn(
                      "block w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-colors",
                      !respondida && "border-border hover:border-primary",
                      respondida && correta && "border-success/60 bg-success/10",
                      respondida && !correta && escolhida === i && "border-destructive/60 bg-destructive/10",
                      respondida && !correta && escolhida !== i && "border-border opacity-60",
                    )}
                  >
                    <span className="mr-2 font-semibold">{String.fromCharCode(65 + i)})</span>
                    {alt}
                  </button>
                );
              })}
            </div>
            {respondida && q.explanation && (
              <p className="mt-4 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">{q.explanation}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
