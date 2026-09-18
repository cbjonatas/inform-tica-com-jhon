import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { perguntarIA } from "@/lib/ia.functions";

type Mensagem = { role: "user" | "assistant"; content: string };

export function AssistenteIA({ contexto }: { contexto?: string }) {
  const chamar = useServerFn(perguntarIA);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const pergunta = texto.trim();
    if (!pergunta || carregando) return;
    const novas: Mensagem[] = [...mensagens, { role: "user", content: pergunta }];
    setMensagens(novas);
    setTexto("");
    setCarregando(true);
    try {
      const r = await chamar({ data: { contexto: contexto ?? "", mensagens: novas } });
      setMensagens([...novas, { role: "assistant", content: r.resposta }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao falar com a IA");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {mensagens.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Pergunte sobre hardware, sistemas operacionais, redes, segurança ou peça um resumo da aula.
          </p>
        )}
        {mensagens.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto w-fit max-w-[85%] rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                : "w-fit max-w-[95%] whitespace-pre-line rounded-xl bg-secondary px-4 py-3 text-sm"
            }
          >
            {m.content}
          </div>
        ))}
        {carregando && <p className="text-sm text-muted-foreground">A IA está pensando...</p>}
      </div>

      <form onSubmit={enviar} className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite sua dúvida de Informática..."
          className="flex-1 rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          disabled={carregando}
          className="rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-60"
          aria-label="Enviar pergunta"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
