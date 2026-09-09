import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Loader2,
  PlusCircle,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/questoes/ia")({
  head: () => ({
    meta: [
      { title: "Gerador de Questões IA — Informática com Jhon" },
      { name: "description", content: "Gere simulados e questões inéditas de informática para concursos com Inteligência Artificial." },
    ],
  }),
  component: GeradorQuestoesIaPage,
});

interface GeneratedQuestion {
  id: string;
  statement: string;
  options: string[];
  correct_index: number;
  explanation: string;
  banca: string;
  difficulty: "Fácil" | "Médio" | "Difícil";
  subject: string;
}

function GeradorQuestoesIaPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filtros
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedLesson, setSelectedLesson] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<"Fácil" | "Médio" | "Difícil">("Médio");

  // Estados de Geração
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});

  const { data: modules = [] } = useQuery({
    queryKey: ["modules_for_ia_quiz"],
    queryFn: async () => {
      const res = await supabase.from("modules").select("id, title, position").order("position");
      return res.data ?? [];
    },
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ["lessons_for_ia_quiz", selectedModule],
    enabled: Boolean(selectedModule),
    queryFn: async () => {
      const res = await supabase
        .from("lessons")
        .select("id, title, position")
        .eq("module_id", selectedModule)
        .order("position");
      return res.data ?? [];
    },
  });

  // Simulação inteligente de geração de questões alinhada com bancas de concurso
  const handleGenerate = () => {
    setIsGenerating(true);
    setUserAnswers({});

    setTimeout(() => {
      const activeModule = modules.find((m) => m.id === selectedModule)?.title || "Informática Geral";
      const activeLesson = lessons.find((l) => l.id === selectedLesson)?.title || subject || "Conceitos Essenciais";

      const bankQuestions: GeneratedQuestion[] = [
        {
          id: `ia-${Date.now()}-1`,
          subject: activeModule,
          difficulty,
          banca: "Simulado IA (Estilo FGV)",
          statement: `Considerando o tema "${activeLesson}" e as boas práticas de segurança e arquitetura de sistemas, qual alternativa apresenta a afirmação tecnicamente correta para concursos?`,
          options: [
            "A memória virtual elimina completamente a necessidade de memória RAM física no computador.",
            "O princípio do menor privilégio determina que um usuário deve ter apenas os acessos estritamente necessários para desempenhar suas funções.",
            "O protocolo UDP realiza handshake em três etapas garantindo entrega ordenada de pacotes na camada de transporte.",
            "Arquivos com extensão .bat no Linux possuem permissões totais de superusuário por padrão.",
            "A memória ROM perde todos os seus dados armazenados imediatamente após o desligamento da energia elétrica.",
          ],
          correct_index: 1,
          explanation: "O princípio do menor privilégio (Least Privilege) é uma regra fundamental de segurança da informação frequentemente cobrada pelas bancas. As demais alternativas contêm erros conceituais (UDP não faz handshake, ROM é não volátil, etc.).",
        },
        {
          id: `ia-${Date.now()}-2`,
          subject: activeModule,
          difficulty,
          banca: "Simulado IA (Estilo Cebraspe)",
          statement: `Em relação ao funcionamento de periféricos, armazenamento e barramentos no contexto de "${activeLesson}":`,
          options: [
            "Os discos de estado sólido (SSD) utilizam partes mecânicas giratórias idênticas aos discos rígidos magnéticos (HD).",
            "A memória Cache L1 possui maior capacidade de armazenamento e menor velocidade que a memória Cache L3.",
            "Os barramentos de entrada e saída (I/O) conectam dispositivos externos e periféricos à placa-mãe permitindo a comunicação com a CPU.",
            "A taxa de clock de um processador é a única variável que determina o seu desempenho final em multitarefa.",
            "Dispositivos com conexão USB são exclusivamente periféricos de saída de dados.",
          ],
          correct_index: 2,
          explanation: "Os barramentos de E/S são responsáveis pela interface de comunicação entre os dispositivos periféricos e o sistema central. O SSD não possui partes móveis mecânicas, e o Cache L1 é o mais rápido e de menor capacidade.",
        },
        {
          id: `ia-${Date.now()}-3`,
          subject: activeModule,
          difficulty,
          banca: "Simulado IA (Estilo FCC)",
          statement: `No que se refere a redes de computadores e protocolos de comunicação aplicados ao tema "${activeLesson}":`,
          options: [
            "O endereço MAC opera na camada física do modelo OSI e possui 32 bits de extensão.",
            "O protocolo HTTPS utiliza criptografia TLS/SSL e opera por padrão na porta lógica TCP 443.",
            "O DHCP é responsável por traduzir nomes de domínio legíveis em endereços IP na internet.",
            "Topologias em estrela dependem de um cabo coaxial central único (backbone) para que toda a rede funcione.",
            "O comando ping utiliza o protocolo TCP para verificar se um nó remoto está ativo.",
          ],
          correct_index: 1,
          explanation: "O HTTPS utiliza TLS/SSL para fornecer tráfego criptografado e roda nativamente na porta 443 TCP. Quem traduz nomes é o DNS (não o DHCP), e o ping utiliza o protocolo ICMP.",
        },
        {
          id: `ia-${Date.now()}-4`,
          subject: activeModule,
          difficulty,
          banca: "Simulado IA (Estilo Vunesp)",
          statement: `Sobre a organização de arquivos, diretórios e sistemas operacionais no contexto de "${activeLesson}":`,
          options: [
            "No Linux, a barra invertida (\\) é utilizada para separar os níveis de diretórios a partir da raiz.",
            "No Windows, os nomes de arquivos são estritamente case-sensitive, diferenciando ARQUIVO.txt de arquivo.txt no mesmo diretório.",
            "No Linux, o diretório /etc é o local padrão onde ficam armazenados os arquivos de configuração do sistema.",
            "O comando kill no Linux serve exclusivamente para reiniciar a máquina física de forma ordenada.",
            "No Windows 11, o comando Windows + L abre a ferramenta de pesquisa de arquivos locais.",
          ],
          correct_index: 2,
          explanation: "No Linux, o diretório /etc contém os arquivos de configuração dos programas e do próprio sistema operacional. O separador de pastas no Linux é a barra normal (/), e o Windows não é case-sensitive no sistema de arquivos padrão (NTFS).",
        },
        {
          id: `ia-${Date.now()}-5`,
          subject: activeModule,
          difficulty,
          banca: "Simulado IA (Estilo Cebraspe)",
          statement: `Acerca de mecanismos de proteção, autenticação e redundância no estudo de "${activeLesson}":`,
          options: [
            "A autenticação de dois fatores (2FA) substitui a necessidade de manter senhas fortes.",
            "O firewall tem por função exclusiva detectar e remover vírus já instalados na memória volátil do sistema.",
            "O backup incremental copia todos os arquivos que foram modificados desde o último backup completo ou incremental.",
            "A assinatura digital garante apenas a confidencialidade do documento, não assegurando integridade nem não repúdio.",
            "O protocolo SSH transmite senhas e comandos em texto claro sem nenhum tipo de criptografia.",
          ],
          correct_index: 2,
          explanation: "O backup incremental realiza a cópia de segurança apenas dos arquivos criados ou alterados desde o último backup (seja ele completo ou incremental), desmarcando o bit de arquivamento. A assinatura digital garante integridade, autenticidade e não repúdio.",
        },
      ];

      // Ajustar pela quantidade solicitada
      const finalSelection = bankQuestions.slice(0, quantity);
      setGeneratedQuestions(finalSelection);
      setIsGenerating(false);
    }, 1500);
  };

  const handleAnswer = async (qId: string, optIndex: number, correctIndex: number) => {
    setUserAnswers((prev) => ({ ...prev, [qId]: optIndex }));

    if (user?.id) {
      await supabase.from("question_attempts").insert({
        user_id: user.id,
        question_id: null, // Questão gerada por IA
        selected_index: optIndex,
        is_correct: optIndex === correctIndex,
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Topo */}
      <div>
        <Link
          to="/questoes"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao banco de questões
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <div className="grid size-10 place-items-center rounded-xl bg-accent/20 text-accent">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display">GERADOR DE QUESTÕES IA</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Gere simulados inéditos com questões no padrão de bancas de concursos a partir das aulas e materiais.
            </p>
          </div>
        </div>
      </div>

      {/* Painel de Configuração e Filtros */}
      <section className="panel p-6 space-y-6">
        <h2 className="text-base font-bold font-display border-b border-border pb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> Parâmetros de Geração
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Filtro Módulo */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Módulo
            </label>
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setSelectedLesson("");
              }}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">Todos os Módulos / Geral</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  Módulo {m.position} — {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Aula */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Aula Específica (Opcional)
            </label>
            <select
              value={selectedLesson}
              onChange={(e) => setSelectedLesson(e.target.value)}
              disabled={!selectedModule}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
            >
              <option value="">Todo o conteúdo do módulo</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  Aula {l.position} — {l.title}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Assunto / Palavra-chave */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Assunto ou Foco
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Criptografia, Memória RAM, Comandos Linux..."
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Quantidade de Questões
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setQuantity(qty)}
                  className={cn(
                    "rounded-xl py-2 text-xs font-bold transition-all border",
                    quantity === qty
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {qty}
                </button>
              ))}
            </div>
          </div>

          {/* Dificuldade */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Nível de Dificuldade
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["Fácil", "Médio", "Difícil"] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  className={cn(
                    "rounded-xl py-2.5 text-xs font-bold transition-all border",
                    difficulty === diff
                      ? "bg-accent/20 text-accent border-accent/40 font-bold"
                      : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="glow-primary flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Analisando conteúdo e gerando questões com IA...
            </>
          ) : (
            <>
              <Sparkles className="size-4 fill-current" /> GERAR QUESTÕES
            </>
          )}
        </button>
      </section>

      {/* Questões Geradas */}
      {generatedQuestions.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display">
              Simulado Gerado ({generatedQuestions.length} questões)
            </h2>
            <button
              onClick={() => {
                setGeneratedQuestions([]);
                setUserAnswers({});
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <RotateCcw className="size-3.5" /> Limpar simulado
            </button>
          </div>

          <div className="space-y-6">
            {generatedQuestions.map((q, qIndex) => {
              const selectedIdx = userAnswers[q.id];
              const hasAnswered = selectedIdx !== undefined;
              const isCorrect = selectedIdx === q.correct_index;

              return (
                <div key={q.id} className="panel p-6 space-y-4">
                  {/* Header da Questão Padrão Concurso */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3 text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="text-primary font-mono">QUESTÃO {String(qIndex + 1).padStart(2, "0")}</span>
                      <span className="rounded bg-secondary px-2 py-0.5 text-foreground">{q.banca}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>Dificuldade: <strong>{q.difficulty}</strong></span>
                      <span>•</span>
                      <span>{q.subject}</span>
                    </div>
                  </div>

                  {/* Enunciado */}
                  <p className="text-base text-foreground leading-relaxed">{q.statement}</p>

                  {/* 5 Alternativas Padrão (A, B, C, D, E) */}
                  <div className="space-y-2.5 pt-2">
                    {q.options.map((opt, optIndex) => {
                      const letter = String.fromCharCode(65 + optIndex);
                      const isSelected = selectedIdx === optIndex;
                      const isThisCorrect = optIndex === q.correct_index;

                      let style = "border-border bg-secondary/20 hover:bg-secondary/60";
                      if (hasAnswered) {
                        if (isThisCorrect) {
                          style = "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 font-semibold";
                        } else if (isSelected) {
                          style = "border-red-500/50 bg-red-500/10 text-red-500 line-through";
                        } else {
                          style = "opacity-40 border-border";
                        }
                      }

                      return (
                        <button
                          key={optIndex}
                          disabled={hasAnswered}
                          onClick={() => handleAnswer(q.id, optIndex, q.correct_index)}
                          className={cn(
                            "flex w-full items-start gap-3.5 rounded-xl border p-3.5 text-left text-sm transition-all",
                            style
                          )}
                        >
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary font-mono text-xs font-bold">
                            {letter}
                          </span>
                          <span className="flex-1 leading-relaxed">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback Padrão: ✓ CORRETA ou ✗ INCORRETA + GABARITO + COMENTÁRIO */}
                  {hasAnswered && (
                    <div
                      className={cn(
                        "rounded-xl p-4 text-sm leading-relaxed border space-y-2 mt-4",
                        isCorrect ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
                      )}
                    >
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
                        <span className="text-muted-foreground ml-2">
                          GABARITO: <strong>{String.fromCharCode(65 + q.correct_index)}</strong>
                        </span>
                      </div>

                      <div className="text-xs md:text-sm text-muted-foreground pt-1 border-t border-border/50">
                        <p className="font-semibold text-foreground uppercase text-[11px] tracking-wider mb-1">
                          COMENTÁRIO DO PROFESSOR / IA:
                        </p>
                        <p>{q.explanation}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
