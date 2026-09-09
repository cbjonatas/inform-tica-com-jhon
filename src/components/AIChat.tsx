import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AIChatMessage {
  id: string;
  sender: "user" | "ia";
  text: string;
}

interface AIChatProps {
  contextTitle?: string;
  contextType?: string;
  presetPrompts?: string[];
  onSendMessage: (text: string) => Promise<string>;
  className?: string;
}

export function AIChat({
  contextTitle,
  contextType = "Aula",
  presetPrompts = [
    "Explique esse assunto.",
    "Qual a diferença entre RAM e ROM?",
    "Faça um resumo dessa aula.",
    "Quais pontos são mais importantes?",
    "Crie questões sobre esse conteúdo.",
  ],
  onSendMessage,
  className,
}: AIChatProps) {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: "welcome",
      sender: "ia",
      text: `Olá! Sou o **Tutor de IA do Jhon**. Estou aqui para esclarecer qualquer dúvida sobre **${contextTitle || "Informática para Concursos"}**. Escolha um comando rápido abaixo ou digite sua pergunta.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isThinking) return;

    setInput("");
    const userMsg: AIChatMessage = {
      id: String(Date.now()),
      sender: "user",
      text: query,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const reply = await onSendMessage(query);
      const aiMsg: AIChatMessage = {
        id: String(Date.now() + 1),
        sender: "ia",
        text: reply,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "ia",
          text: "Desculpe, ocorreu uma instabilidade na conexão com o serviço de IA. Por favor, tente novamente.",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Context Badge */}
      {contextTitle && (
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <Sparkles className="size-4 text-accent" />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
              Contexto Ativo: {contextType}
            </span>
            <p className="text-xs font-semibold text-foreground truncate">{contextTitle}</p>
          </div>
        </div>
      )}

      {/* Prompts Rápidos */}
      {presetPrompts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presetPrompts.map((pText) => (
            <button
              key={pText}
              type="button"
              onClick={() => handleSend(pText)}
              className="rounded-xl bg-secondary/80 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border"
            >
              "{pText}"
            </button>
          ))}
        </div>
      )}

      {/* Área de Mensagens */}
      <div className="h-64 overflow-y-auto space-y-3 rounded-2xl border border-border bg-secondary/15 p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex gap-2.5 max-w-[85%]",
              m.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold",
                m.sender === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent/20 text-accent"
              )}
            >
              {m.sender === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
            </div>

            <div
              className={cn(
                "rounded-2xl px-4 py-2.5 text-xs md:text-sm leading-relaxed",
                m.sender === "user"
                  ? "bg-primary text-primary-foreground"
                  : "panel border border-border text-foreground"
              )}
            >
              <div className="whitespace-pre-line">{m.text}</div>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 animate-spin text-accent" /> O Tutor Jhon está formulando a explicação...
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input de Mensagem */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte ao tutor de IA sobre esta matéria..."
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-xs focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || isThinking}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50 transition-transform hover:scale-[1.02]"
        >
          <Send className="size-3.5" /> Perguntar
        </button>
      </form>
    </div>
  );
}
