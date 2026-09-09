import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, User, RefreshCw, BookOpen, ShieldAlert, Cpu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ia")({
  head: () => ({
    meta: [
      { title: "Tutor de IA — Informática com Jhon" },
      { name: "description", content: "Tire dúvidas e revise matérias de informática para concursos com IA." },
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
  const { profile, user } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Olá, ${profile?.full_name?.split(" ")[0] || "estudante"}! Sou o **Tutor de IA do Jhon**.
      
Estou aqui para acelerar sua preparação em **Informática para Concursos Públicos**. Você pode me pedir:
* Explicações de conceitos teóricos difíceis
* Comparativos e macetes de memorização
* Pegadinhas clássicas das bancas (Cebraspe, FGV, FCC, Vunesp)
* Resoluções comentadas de questões

Selecione um dos temas rápidos abaixo ou digite sua dúvida!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const generateAnswer = (promptText: string) => {
    const text = promptText.toLowerCase();

    if (text.includes("memória") || text.includes("cache") || text.includes("ram")) {
      return `📌 **Hierarquia de Memórias para Concursos:**

1. **Registradores:** Localizados dentro da CPU. São as memórias **mais rápidas, mais caras por bit e com menor capacidade** (ordem de bytes).
2. **Memória Cache (L1, L2, L3):** Memória estática (SRAM), extremamente rápida, faz a ponte entre os registradores e a RAM para diminuir a ociosidade do processador.
3. **Memória Principal (RAM):** Memória dinâmica (DRAM), **volátil** (perde os dados sem energia). Armazena os programas e dados em execução no momento.
4. **Memória Secundária (SSD / HD):** Memória permanente (**não volátil**), maior capacidade de armazenamento e menor custo por gigabyte.

💡 *Pegadinha clássica de prova:* As bancas adoram afirmar que a memória ROM é volátil ou que o cache substitui o HD. Fique atento: ROM e SSD são **não voláteis**; RAM e Cache são **voláteis**!`;
    }

    if (text.includes("linux") || text.includes("chmod") || text.includes("comando")) {
      return `🐧 **Linux para Concursos — Pontos Críticos:**

* \`chmod\`: altera **permissões** de leitura (\`r=4\`), escrita (\`w=2\`) e execução (\`x=1\`).
  * Exemplo: \`chmod 755 arquivo\` -> Dono tem 7 (4+2+1, total), Grupo tem 5 (4+1, leitura e execução), Outros têm 5.
* \`chown\`: altera o **proprietário** (owner) do arquivo ou diretório.
* \`ls -la\`: lista arquivos incluindo ocultos (que começam com \`.\`) com permissões detalhadas.
* \`grep\`: busca padrões ou palavras dentro de arquivos.
* \`ps aux\` ou \`top\`: visualiza processos em execução.

💡 *Atenção:* O Linux é *case-sensitive* (diferencia maiúsculas de minúsculas) em seus comandos e nomes de arquivos.`;
    }

    if (text.includes("malware") || text.includes("segurança") || text.includes("trojan") || text.includes("ransomware")) {
      return `🛡️ **Principais Ameaças (Malwares) cobradas em Concursos:**

* **Vírus:** Necessita de um hospedeiro (arquivo executável) e de ação do usuário para se propagar.
* **Worm (Verme):** Auto-replicável. Não necessita de hospedeiro nem de ação do usuário; propaga-se diretamente através das vulnerabilidades da rede.
* **Trojan (Cavalo de Troia):** Disfarça-se de programa legítimo/útil para abrir portas e permitir acesso remoto não autorizado (*backdoor*).
* **Ransomware:** Sequestra dados criptografando arquivos do sistema e exige resgate (normalmente em criptomoedas).
* **Spyware:** Monitora as atividades do usuário e envia informações a terceiros (ex: *Keylogger*, *Screenlogger*).`;
    }

    return `Entendi sua dúvida sobre **"${promptText}"**!

Na abordagem para concursos públicos, este tópico costuma ser avaliado com foco em:
1. **Definição precisa:** Não confunda sinônimos com termos técnicos formais adotados pelas bancas.
2. **Contexto prático:** Como isso se aplica no ambiente do usuário (atalhos, configurações de rede, painéis de controle).
3. **Exceções:** As bancas geralmente focam em casos em que a regra geral não se aplica ou em novidades de atualizações recentes.

Gostaria de ver uma questão de concurso simulada sobre esse tema para testar seus conhecimentos?`;
  };

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isTyping) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const replyContent = generateAnswer(query);
      const botMsg: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: replyContent,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[500px]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border pb-4 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-accent/20 text-accent">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display md:text-2xl">Tutor de IA do Jhon</h1>
            <p className="text-xs text-muted-foreground">Especialista em Informática para Concursos Públicos</p>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([messages[0]]);
          }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Reiniciar conversa"
        >
          <RefreshCw className="size-3.5" /> Limpar chat
        </button>
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
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent/20 text-accent"
              )}
            >
              {msg.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
            </div>

            <div
              className={cn(
                "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "panel border-border text-foreground space-y-2"
              )}
            >
              <div className="whitespace-pre-line">{msg.content}</div>
              <p
                className={cn(
                  "text-[10px] text-right mt-1.5",
                  msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                )}
              >
                {msg.timestamp}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <div className="grid size-8 place-items-center rounded-xl bg-accent/20 text-accent">
              <Sparkles className="size-4 animate-spin" />
            </div>
            <span>O Tutor Jhon está elaborando a resposta...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Caixa de Entrada */}
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
          placeholder="Pergunte sobre qualquer matéria de informática para concurso..."
          className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || isTyping}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-sm text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          <Send className="size-4" /> Enviar
        </button>
      </form>
    </div>
  );
}
