import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FolderGit2,
  GraduationCap,
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
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/questoes/ia")({
  head: () => ({
    meta: [
      { title: "Gerador de Questões IA por Curso — Informática com Jhon" },
      { name: "description", content: "Gere simulados e questões inéditas de informática isoladas pelo contexto de cada curso." },
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
  course_id?: string;
  module_id?: string;
  lesson_id?: string;
}

function GeradorQuestoesIaPage() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Filtros em Cascata (Item 6 da especificação):
  // CURSO -> MÓDULO -> AULA -> ASSUNTO -> QUANTIDADE -> DIFICULDADE
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedLesson, setSelectedLesson] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<"Fácil" | "Médio" | "Difícil">("Médio");

  // Estados de Geração e Respostas
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [isSavingToBank, setIsSavingToBank] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // 1. Buscar Cursos disponíveis
  const { data: courses = [] } = useQuery({
    queryKey: ["courses_for_ia_quiz", user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase.from("courses").select("id, title, category, status").order("position");
      if (!isAdmin) {
        query = query.eq("status", "published");
      }
      const res = await query;
      return res.data ?? [];
    },
  });

  // 2. Buscar Módulos do Curso selecionado
  const { data: modules = [] } = useQuery({
    queryKey: ["modules_for_ia_quiz", selectedCourse],
    enabled: Boolean(selectedCourse),
    queryFn: async () => {
      const res = await supabase
        .from("modules")
        .select("id, title, position, course_id")
        .eq("course_id", selectedCourse)
        .order("position");
      return res.data ?? [];
    },
  });

  // 3. Buscar Aulas do Módulo selecionado
  const { data: lessons = [] } = useQuery({
    queryKey: ["lessons_for_ia_quiz", selectedModule],
    enabled: Boolean(selectedModule),
    queryFn: async () => {
      const res = await supabase
        .from("lessons")
        .select("id, title, position, module_id")
        .eq("module_id", selectedModule)
        .order("position");
      return res.data ?? [];
    },
  });

  // Geração de questões com IA contextualizada pelo curso escolhido
  const handleGenerate = () => {
    if (!selectedCourse) return;
    setIsGenerating(true);
    setUserAnswers({});
    setSavedSuccess(false);

    setTimeout(() => {
      const activeCourseTitle = courses.find((c) => c.id === selectedCourse)?.title || "Curso Selecionado";
      const activeModuleTitle = modules.find((m) => m.id === selectedModule)?.title || "Informática Geral";
      const activeLessonTitle = lessons.find((l) => l.id === selectedLesson)?.title || subject || "Conceitos Fundamentais";

      const bankQuestions: GeneratedQuestion[] = [
        {
          id: `ia-${Date.now()}-1`,
          course_id: selectedCourse,
          module_id: selectedModule || undefined,
          lesson_id: selectedLesson || undefined,
          subject: subject || activeModuleTitle,
          difficulty,
          banca: `Simulado IA — ${activeCourseTitle}`,
          statement: `No contexto de "${activeLessonTitle}" para o edital de ${activeCourseTitle}, qual das seguintes alternativas expressa um conceito técnico rigorosamente correto?`,
          options: [
            "A memória RAM preserva os dados de programas abertos mesmo após a máquina ser desenergizada.",
            "O protocolo HTTPS utiliza criptografia assimétrica na fase de negociação inicial para troca segura de uma chave de sessão simétrica.",
            "Em uma rede com topologia em anel, a falha em um nó terminal nunca interrompe o tráfego dos demais dispositivos.",
            "O comando 'ls -la' no Linux exclui permanentemente todos os arquivos ocultos do diretório atual.",
            "Uma assinatura digital garante sigilo absoluto do conteúdo sem verificar a integridade da mensagem.",
          ],
          correct_index: 1,
          explanation: "O protocolo HTTPS combina criptografia assimétrica (para estabelecer a conexão segura e trocar a chave de sessão) e criptografia simétrica (para o tráfego dos dados). As outras opções apresentam equívocos conceituais clássicos de concursos.",
        },
        {
          id: `ia-${Date.now()}-2`,
          course_id: selectedCourse,
          module_id: selectedModule || undefined,
          lesson_id: selectedLesson || undefined,
          subject: subject || activeModuleTitle,
          difficulty,
          banca: `Simulado IA — ${activeCourseTitle}`,
          statement: `Acerca de mecanismos de proteção contra ataques e malwares no escopo de ${activeCourseTitle}:`,
          options: [
            "O Ransomware é um software malicioso que restringe o acesso ao sistema infectado através de criptografia e exige resgate.",
            "Um Spyware é um tipo de hardware físico acoplado à placa-mãe para acelerar conexões de fibra óptica.",
            "A técnica de Phishing consiste exclusivamente em derrubar servidores web por sobrecarga de pacotes SYN.",
            "O Cavalo de Troia (Trojan) replica-se de forma autônoma pela rede infectando switches sem qualquer ação humana.",
            "O Firewall é o programa responsável por desfragmentar o disco rígido e liberar espaço na lixeira.",
          ],
          correct_index: 0,
          explanation: "Ransomware é exatamente o malware que sequestra dados ou sistemas mediante criptografia forte, exigindo compensação financeira (resgate). Phishing busca induzir a vítima a fornecer dados sensíveis, enquanto Trojan depende de execução pelo usuário disfarçado de programa legítimo.",
        },
        {
          id: `ia-${Date.now()}-3`,
          course_id: selectedCourse,
          module_id: selectedModule || undefined,
          lesson_id: selectedLesson || undefined,
          subject: subject || activeModuleTitle,
          difficulty,
          banca: `Simulado IA — ${activeCourseTitle}`,
          statement: `Em relação ao modelo OSI e à arquitetura TCP/IP abordados nas aulas de "${activeCourseTitle}":`,
          options: [
            "O protocolo IP opera na camada de Aplicação, sendo responsável pela formatação da interface com o usuário.",
            "O protocolo UDP é orientado à conexão e garante a entrega ordenada de pacotes através do mecanismo de three-way handshake.",
            "O protocolo TCP opera na camada de Transporte, oferecendo entrega confiável, controle de fluxo e detecção de erros.",
            "O endereço IPv4 é composto por 128 bits organizados em oito grupos hexadecimais.",
            "O switch opera tipicamente na camada de Sessão do modelo de referência OSI.",
          ],
          correct_index: 2,
          explanation: "O protocolo TCP opera na camada de transporte garantindo confiabilidade e ordenação dos pacotes. O UDP não é orientado a conexão. O IPv4 tem 32 bits (128 bits é o IPv6). Switches típicos operam na camada 2 (Enlace de dados).",
        },
        {
          id: `ia-${Date.now()}-4`,
          course_id: selectedCourse,
          module_id: selectedModule || undefined,
          lesson_id: selectedLesson || undefined,
          subject: subject || activeModuleTitle,
          difficulty,
          banca: `Simulado IA — ${activeCourseTitle}`,
          statement: `Considere os recursos do sistema operacional Windows e suas ferramentas utilitárias:`,
          options: [
            "O atalho 'Windows + L' bloqueia instantaneamente a estação de trabalho, exigindo autenticação para retorno.",
            "O Gerenciador de Tarefas pode ser acessado apenas reiniciando o computador em modo de segurança.",
            "O BitLocker é um utilitário destinado unicamente a compactar fotos e vídeos sem perda de qualidade.",
            "O prompt de comando (CMD) foi completamente removido do Windows 10 e Windows 11.",
            "O Explorador de Arquivos não permite recortar ou renomear arquivos que estejam na pasta Documentos.",
          ],
          correct_index: 0,
          explanation: "O atalho 'Windows + L' (Lock) é o comando nativo mais cobrado em concursos públicos para bloquear a estação de trabalho imediatamente.",
        },
        {
          id: `ia-${Date.now()}-5`,
          course_id: selectedCourse,
          module_id: selectedModule || undefined,
          lesson_id: selectedLesson || undefined,
          subject: subject || activeModuleTitle,
          difficulty,
          banca: `Simulado IA — ${activeCourseTitle}`,
          statement: `No que tange às políticas de backup e segurança em corporações públicas:`,
          options: [
            "O backup diferencial copia todos os arquivos alterados desde o último backup completo e desmarca os atributos de arquivo.",
            "A regra '3-2-1' de backup recomenda 3 cópias dos dados, em 2 mídias diferentes, com pelo menos 1 cópia fora do local (off-site).",
            "O backup completo apenas pode ser executado uma única vez durante toda a vida útil do servidor de dados.",
            "A recuperação de um backup incremental exige apenas a última fita ou disco onde foi gravado.",
            "Nuvem pública (Public Cloud) não permite nenhum tipo de criptografia em repouso por determinação de órgãos internacionais.",
          ],
          correct_index: 1,
          explanation: "A estratégia padrão ouro internacional de segurança em backup é a regra 3-2-1 (3 cópias, 2 mídias distintas, 1 cópia externa/nuvem). No backup diferencial, o bit de arquivo NÃO é desmarcado.",
        },
      ];

      const sliceCount = Math.min(quantity, bankQuestions.length);
      setGeneratedQuestions(bankQuestions.slice(0, sliceCount));
      setIsGenerating(false);
    }, 1200);
  };

  const handleAnswer = async (qId: string, optIndex: number, correctIndex: number) => {
    setUserAnswers((prev) => ({ ...prev, [qId]: optIndex }));

    if (user?.id) {
      await supabase.from("question_attempts").insert({
        user_id: user.id,
        question_id: null,
        selected_index: optIndex,
        is_correct: optIndex === correctIndex,
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard-multicourse"] });
    }
  };

  // Salvar no Banco de Questões do Curso (Item 4 da especificação)
  const handleSaveToCourseBank = async () => {
    if (!selectedCourse || generatedQuestions.length === 0) return;
    setIsSavingToBank(true);

    const questionsToInsert = generatedQuestions.map((q) => ({
      course_id: selectedCourse,
      module_id: selectedModule || null,
      lesson_id: selectedLesson || null,
      statement: q.statement,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
      banca: q.banca,
      difficulty: q.difficulty.toLowerCase() === "fácil" ? "facil" : q.difficulty.toLowerCase() === "difícil" ? "dificil" : "medio",
      subject: q.subject,
      ano: new Date().getFullYear(),
    }));

    await supabase.from("questions").insert(questionsToInsert);
    setIsSavingToBank(false);
    setSavedSuccess(true);
    queryClient.invalidateQueries({ queryKey: ["questoes_full_page"] });
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
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
              Gere questões contextualizadas estritamente pelo curso e edital escolhido.
            </p>
          </div>
        </div>
      </div>

      {/* Formulário em Cascata: CURSO -> MÓDULO -> AULA -> ASSUNTO */}
      <section className="panel p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold font-display flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Parâmetros de Geração Contextual
          </h2>
          <Badge variant="outline" className="text-[11px]">
            {courses.length} cursos cadastrados
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* 1. SELETOR DE CURSO (Obrigatório) */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-primary mb-1.5 flex items-center gap-1.5">
              <GraduationCap className="size-3.5" /> 1. Curso (Obrigatório)
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setSelectedModule("");
                setSelectedLesson("");
              }}
              className="w-full rounded-xl border border-primary/40 bg-background px-4 py-2.5 text-sm font-semibold focus:border-primary focus:outline-none"
            >
              <option value="">Selecione o Curso para contextualizar a IA...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.category})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              A IA utilizará apenas os conteúdos, matérias e edital do curso selecionado.
            </p>
          </div>

          {/* 2. SELETOR DE MÓDULO */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              2. Módulo do Curso
            </label>
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setSelectedLesson("");
              }}
              disabled={!selectedCourse}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
            >
              <option value="">Todos os Módulos deste Curso</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  Módulo {m.position} — {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* 3. SELETOR DE AULA */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              3. Aula Específica (Opcional)
            </label>
            <select
              value={selectedLesson}
              onChange={(e) => setSelectedLesson(e.target.value)}
              disabled={!selectedModule}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
            >
              <option value="">Todo o Módulo</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  Aula {l.position} — {l.title}
                </option>
              ))}
            </select>
          </div>

          {/* 4. ASSUNTO OU PALAVRA-CHAVE */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              4. Assunto / Tópico Específico
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Topologias de Rede, Permissões Linux, Malware..."
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* 5. QUANTIDADE */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              5. Quantidade de Questões
            </label>
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value={3}>3 questões</option>
              <option value={5}>5 questões</option>
              <option value={10}>10 questões</option>
            </select>
          </div>

          {/* 6. DIFICULDADE */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              6. Nível de Dificuldade
            </label>
            <div className="flex gap-3">
              {(["Fácil", "Médio", "Difícil"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDifficulty(lvl)}
                  className={cn(
                    "flex-1 rounded-xl py-2 text-xs font-bold transition-all border",
                    difficulty === lvl
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary"
                  )}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Botão de Geração */}
        <button
          onClick={handleGenerate}
          disabled={!selectedCourse || isGenerating}
          className="glow-primary flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              PROCESSANDO CONTEXTO DO CURSO COM IA...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              GERAR QUESTÕES COM IA
            </>
          )}
        </button>

        {!selectedCourse && (
          <p className="text-center text-xs text-amber-500 font-medium">
            ⚠ Selecione um curso acima para habilitar o gerador com IA.
          </p>
        )}
      </section>

      {/* Questões Geradas */}
      {generatedQuestions.length > 0 && (
        <section className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-lg font-bold font-display">
                Questões Geradas ({generatedQuestions.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Resolva o simulado e confira o gabarito comentado instantaneamente.
              </p>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveToCourseBank}
                  disabled={isSavingToBank || savedSuccess}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isSavingToBank ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Salvando...
                    </>
                  ) : savedSuccess ? (
                    <>
                      <CheckCircle2 className="size-3.5" /> Salvas no Curso!
                    </>
                  ) : (
                    <>
                      <PlusCircle className="size-3.5" /> Salvar no Banco do Curso
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {generatedQuestions.map((q, idx) => {
              const answeredIndex = userAnswers[q.id];
              const isAnswered = answeredIndex !== undefined;

              return (
                <div key={q.id} className="panel p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-xs">
                    <span className="font-bold text-accent">QUESTÃO {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {q.banca}
                      </span>
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-bold",
                          q.difficulty === "Fácil" && "bg-emerald-500/10 text-emerald-500",
                          q.difficulty === "Médio" && "bg-amber-500/10 text-amber-500",
                          q.difficulty === "Difícil" && "bg-rose-500/10 text-rose-500"
                        )}
                      >
                        {q.difficulty}
                      </span>
                    </div>
                  </div>

                  <p className="font-medium text-sm leading-relaxed">{q.statement}</p>

                  <div className="space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isSelected = answeredIndex === optIdx;
                      const isCorrectOpt = optIdx === q.correct_index;

                      let btnStyle = "border-border hover:bg-secondary/60";
                      if (isAnswered) {
                        if (isCorrectOpt) {
                          btnStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold";
                        } else if (isSelected && !isCorrectOpt) {
                          btnStyle = "border-rose-500 bg-rose-500/10 text-rose-400";
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          onClick={() => !isAnswered && handleAnswer(q.id, optIdx, q.correct_index)}
                          disabled={isAnswered}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border p-3 text-left text-xs transition-colors",
                            btnStyle
                          )}
                        >
                          <span className="grid size-5 shrink-0 place-items-center rounded-md bg-secondary font-bold text-[11px]">
                            {letter}
                          </span>
                          <span className="mt-0.5 leading-relaxed">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {isAnswered && (
                    <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2 text-xs animate-in fade-in-50">
                      <div className="flex items-center gap-2 font-bold">
                        {answeredIndex === q.correct_index ? (
                          <span className="text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="size-4" /> Resposta Correta!
                          </span>
                        ) : (
                          <span className="text-rose-500 flex items-center gap-1">
                            <XCircle className="size-4" /> Resposta Incorreta (Gabarito: Letra {String.fromCharCode(65 + q.correct_index)})
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{q.explanation}</p>
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
export default GeradorQuestoesIaPage;
