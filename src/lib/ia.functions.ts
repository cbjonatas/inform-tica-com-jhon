import { createServerFn } from "@tanstack/react-start";

type Mensagem = { role: "user" | "assistant"; content: string };

export const perguntarIA = createServerFn({ method: "POST" })
  .inputValidator((input: { contexto?: string; mensagens: Mensagem[] }) => {
    if (!Array.isArray(input?.mensagens) || input.mensagens.length === 0) {
      throw new Error("Envie ao menos uma mensagem.");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("A IA não está configurada.");

    const system = [
      "Você é o assistente de estudos do curso INFORMÁTICA COM JHON PARA CONCURSOS.",
      "Responda sempre em português do Brasil, com foco em provas de concursos públicos.",
      "Seja objetivo, use exemplos de banca e destaque pegadinhas comuns.",
      data.contexto ? `Contexto da aula: ${data.contexto}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [{ role: "system", content: system }, ...data.mensagens],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Muitas perguntas seguidas. Aguarde alguns segundos.");
      if (res.status === 402) throw new Error("Os créditos de IA acabaram. Peça ao professor para recarregar.");
      throw new Error("A IA não conseguiu responder agora.");
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { resposta: json.choices?.[0]?.message?.content ?? "Não consegui gerar uma resposta." };
  });
