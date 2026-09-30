import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Send, Sparkles, User, RefreshCw, BookOpen, ShieldAlert, Cpu, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/ia")({
  validateSearch: (search: Record<string, unknown>) => ({
    cursoId: typeof search.cursoId === "string" ? search.cursoId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Tutor de IA — Informática com Jhon" },
      { name: "description", content: "Tire dúvidas e revise matérias de informática isoladas pelo contexto do seu concurso." },
    ],
  }),
  component: IaPage,
});

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const PRESET_PROMPTS = [
  {
    icon: Cpu,
    label: "Hierarquia de Memórias",
    prompt: "Explique a hierarquia de memórias (Registradores, Cache L1/L2/L3, RAM, Memória Secundária) focando em velocidade, custo e capacidade para concurso.",
  },
  {
    icon: BookOpen,
    label: "Comandos Linux (chmod / chown)",
    prompt: "Quais são os comandos de Linux mais cobrados pelas bancas Cebraspe e FGV? Explique permissões numéricas (ex: 755 e 644).",
  },
  {
    icon: ShieldAlert,
    label: "Malwares e Segurança",
    prompt: "Qual a diferença conceitual cobrada em concursos entre Vírus, Worm, Trojan (Cavalo de Troia), Ransomware e Spyware?",
  },
  {
    icon: Sparkles,
    label: "Modelo OSI vs TCP/IP",
    prompt: "Compare as camadas do modelo OSI e da pilha TCP/IP, indicando quais protocolos operam em cada camada.",
  },
];

function IaPage() {
  const { cursoId: queryCursoId } = Route.useSearch();
  const { profile, user, isAdmin } = useAuth();
  const [selectedCourseId, setSelectedCourseId] = useState<string>(queryCursoId || "");

  // Buscar cursos do aluno para isolamento contextual (Item 5 da especificação)
  const { data: courses = [] } = useQuery({
    queryKey: ["ia_courses", user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase.from("courses").select("id, title, category").order("position");
      if (!isAdmin) {
        query = query.eq("status", "published");
      }
      const res = await query;
      return res.data ?? [];
    },
  });

  const activeCourse =
    courses.find((c) => c.id === selectedCourseId) || courses[0] || null;

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Olá, ${profile?.full_name?.split(" ")[0] || "estudante"}! Sou o **Tutor de IA do Jhon**.
      
Estou aqui para acelerar sua preparação em **Informática para Concursos Públicos**, com foco total no edital do seu curso.
Você pode me pedir:
* Explicações de conceitos teóricos difíceis
* Comparativos e macetes de memorização
* Pegadinhas clássicas das bancas examinadoras
* Resoluções comentadas de questões

Selecione um dos temas rápidos abaixo ou envie sua dúvida!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const generateAnswer = (promptText: string, courseTitle: string) => {
    const text = promptText.toLowerCase();

    if (text.includes("memória") || text.includes("cache") || text.includes("ram")) {
      return `📌 **Hierarquia de Memórias — Foco: ${courseTitle}**

1. **Registradores:** Localizados dentro da CPU. São as memórias **mais rápidas, mais caras por bit e com menor capacidade** (ordem de bytes).
2. **Memória Cache (L1, L2, L3):** Memória estática (SRAM), extremamente rápida, faz a ponte entre os registradores e a RAM para diminuir a ociosidade do processador.
3. **Memória Principal (RAM):** Memória dinâmica (DRAM), **volátil** (perde os dados sem energia). Armazena os programas e dados em execução no momento.
4. **Memória Secundária (SSD / HD):** Memória permanente (**não volátil**), maior capacidade de armazenamento e menor custo por gigabyte.

💡 *Pegadinha clássica em provas de ${courseTitle}:* As bancas adoram afirmar que a memória ROM é volátil ou que o cache substitui o HD. Lembre-se: ROM e SSD são **não voláteis**; RAM e Cache são **voláteis**!`;
    }

    if (text.includes("linux") || text.includes("chmod") || text.includes("comando")) {
      return `🐧 **Linux para Concursos — Foco: ${courseTitle}**

* \`chmod\`: altera **permissões** de leitura (\`r=4\`), escrita (\`w=2\`) e execução (\`x=1\`).
  * Exemplo: \`chmod 755 arquivo\` -> Dono tem 7 (4+2+1, total), Grupo tem 5 (4+1, leitura e execução), Outros têm 5.
* \`chown\`: altera o **proprietário** (owner) do arquivo ou diretório.
* \`ls -la\`: lista arquivos incluindo ocultos (que começam com \`.\`) com permissões detalhadas.
* \`grep\`: busca padrões ou palavras dentro de arquivos.
* \`ps aux\` ou \`top\`: visualiza processos em execução.

💡 *Atenção:* No edital de ${courseTitle}, é fundamental saber que o Linux é *case-sensitive* (diferencia maiúsculas de minúsculas).`;
    }

    if (text.includes("malware") || text.includes("segurança") || text.includes("trojan") || text.includes("ransomware")) {
      return `🛡️ **Segurança da Informação e Malwares — Foco: ${courseTitle}**

* **Vírus:** Necessita de um programa hospedeiro e de execução explícita pelo usuário para se propagar.
* **Worm (Verme):** Autoexecutável e autopropagável. Propaga-se automaticamente explorando vulnerabilidades na rede.
* **Trojan (Cavalo de Troia):** Disfarça-se de programa útil ou jogo, mas executa ações maliciosas ocultas em segundo plano.
* **Ransomware:** Criptografa arquivos do sistema e exige resgate financeiro (frequentemente em criptomoedas).
* **Spyware:** Monitora e furta informações do usuário (ex: Keyloggers capturam teclas, Screenloggers capturam telas).

💡 *Dica do Jhon para ${courseTitle}:* O Worm NÃO precisa de hospedeiro, o Vírus PRECISA de hospedeiro!`;
    }

    return `Entendi sua dúvida sobre "${promptText}" para a preparação em **${courseTitle}**!

Com base nos tópicos mais recorrentes das bancas para este concurso:
1. Revise a teoria fundamental no módulo correspondente.
2. Foque nas palavras-chave do enunciado que as bancas costumam trocar para induzir ao erro.
3. Pratique questões comentadas no nosso Banco de Questões do curso.

Se desejar, detalhe mais o comando, protocolo ou conceito que você quer que eu esquematize passo a passo!`;
  };

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isTyping) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const activeTitle = activeCourse?.title || "Informática para Concursos";

    setTimeout(() => {
      const replyContent = generateAnswer(query, activeTitle);
      const botMsg: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: replyContent,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 700);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[500px]">
      {/* Header com Seletor de Curso (Item 5 da especificação) */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-accent/20 text-accent">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display md:text-2xl">Tutor de IA do Jhon</h1>
            <p className="text-xs text-muted-foreground">Especialista em Informática para Concursos Públicos</p>
          </div>
        </div>

        {/* Seletor de Contexto do Curso */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <GraduationCap className="size-4 text-primary" />
          <span className="text-xs text-muted-foreground">Contexto:</span>
          <select
            value={activeCourse?.id || ""}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="rounded-lg border border-primary/40 bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => setMessages([messages[0]])}
            className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Reiniciar conversa"
          >
            <RefreshCw className="size-3.5" /> Limpar
          </button>
        </div>
      </header>

      {/* Sugestões de Perguntas Rápidas */}
      {messages.length <= 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4 shrink-0">
          {PRESET_PROMPTS.map((item) => (
            <button
              key={item.label}
              onClick={() => handleSend(item.prompt)}
              className="panel flex items-start gap-2.5 p-3 text-left transition-all hover:border-primary hover:bg-secondary/40 group"
            >
              <item.icon className="size-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  {item.label}
                </p>
                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                  Ver explicação de prova
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto space-y-4 rounded-2xl border border-border bg-secondary/10 p-4 md:p-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 max-w-3xl",
              msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-xl text-xs font-bold",
                msg.role === "assistant"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              )}
            >
              {msg.role === "assistant" ? <Bot className="size-4" /> : <User className="size-4" />}
            </div>

            <div className="space-y-1">
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-xs leading-relaxed md:text-sm whitespace-pre-wrap",
                  msg.role === "assistant"
                    ? "border border-border bg-card text-foreground"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {msg.content}
              </div>
              <span className="block px-2 text-[10px] text-muted-foreground">{msg.timestamp}</span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground text-xs">
              <Bot className="size-4 animate-spin" />
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
              O Tutor de IA está pesquisando e elaborando a resposta para {activeCourse?.title || "o curso"}...
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input de Pergunta */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="mt-4 flex gap-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Tire sua dúvida com a IA para ${activeCourse?.title || "seu curso"}...`}
          className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-xs md:text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || isTyping}
          className="glow-primary inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          <Send className="size-4" />
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </form>
    </div>
  );
}
export default IaPage;
