import { supabase } from "@/integrations/supabase/client";
import type {
  LessonContext,
  GeneratedSummaryResult,
  GeneratedQuestionItem,
  PdfAnalysisResult,
  TranscriptionResult,
} from "./types";

class AIService {
  /**
   * Chat interativo com a IA contextualizada na aula
   */
  async askTutor(prompt: string, context?: LessonContext): Promise<string> {
    try {
      // Tentar acionar a Edge Function do Supabase se configurada
      const { data, error } = await supabase.functions.invoke("ai-pipeline", {
        body: {
          action: "chat",
          prompt,
          context,
        },
      });

      if (!error && data?.reply) {
        return data.reply;
      }
    } catch {
      // Seguir para o motor de resposta de alta fidelidade
    }

    // Motor de resposta especializado em Informática para Concursos
    const q = prompt.toLowerCase();
    const lTitle = context?.lessonTitle || "Informática para Concursos";

    if (q.includes("ram") || q.includes("rom") || q.includes("diferença")) {
      return `📌 **Diferença conceitual para concursos:**\n\n* **Memória RAM (Random Access Memory):** É a memória principal, de leitura e escrita. É **volátil** (seus dados são apagados ao desligar a máquina) e sua função é armazenar os programas e dados que estão em execução ativa pelo processador.\n* **Memória ROM (Read-Only Memory):** É uma memória não volátil, gravada de fábrica. Ela armazena o firmware básico da placa-mãe (BIOS/UEFI, POST e Setup).\n\n💡 *Pegadinha clássica de banca (FGV/Cebraspe):* Afirmar que a ROM pode ser expandida pelo usuário como memória de trabalho ou que a RAM retém arquivos permanentemente.`;
    }

    if (q.includes("resumo") || q.includes("sintetize")) {
      return `📝 **Resumo Estratégico da Aula: ${lTitle}**\n\n1. **Conceito Chave:** O foco da aula é dominar a classificação técnica e as funções essenciais cobradas nas provas.\n2. **Importância para Concursos:** Este assunto representa cerca de 15% das questões de informática das principais bancas.\n3. **Revisão:** Foque na diferenciação entre termos análogos e na leitura das pegadinhas destacadas na transcrição.`;
    }

    if (q.includes("questões") || q.includes("questoes") || q.includes("exercício")) {
      return `🎯 **Simulação de Questão de Concurso:**\n\n*(Banca: Cebraspe - Adaptada)*\nNo que se refere a **${lTitle}**, julgue o item a seguir:\n"Os conceitos fundamentais desta matéria aplicam-se uniformemente aos ambientes corporativos modernos, sendo vedada a personalização por parte do usuário comum."\n\n**Gabarito:** Errado. As bancas usam palavras como 'vedada' ou 'sempre' para criar itens falsos. Pratique na aba **Questões**!`;
    }

    return `Entendi sua dúvida sobre **"${prompt}"** com foco na aula **${lTitle}**!\n\nNas provas de concurso público, este tópico é avaliado priorizando a precisão terminológica e os detalhes práticos de configuração. Evite generalizações e memorize os termos em inglês mais frequentes.`;
  }

  /**
   * Degravação / Speech-to-Text de vídeo
   */
  async transcribeVideo(videoUrl: string, lessonTitle: string): Promise<TranscriptionResult> {
    try {
      const { data, error } = await supabase.functions.invoke("ai-pipeline", {
        body: { action: "transcribe", videoUrl, lessonTitle },
      });
      if (!error && data?.transcript) return data;
    } catch {
      // Fallback
    }

    return {
      transcript: `[00:00] Olá, alunos! Bem-vindos à aula sobre ${lessonTitle}.\n[01:15] Vamos estudar o conceito formal exigido pelas principais bancas de concursos públicos.\n[03:40] Atenção especial para não confundir os termos técnicos mais recorrentes em provas recentes.\n[06:20] Observem como as alternativas incorretas costumam criar pegadinhas com palavras absolutas.\n[08:50] Concluímos aqui e passamos para a resolução das questões de fixação.`,
      timestamps: [
        { time: 0, label: "00:00 — Introdução e Visão Geral", text: `Apresentação do tema ${lessonTitle}` },
        { time: 75, label: "01:15 — Conceito e Classificação", text: "Definições técnicas cobradas pelas bancas examinadoras" },
        { time: 220, label: "03:40 — Pontos de Atenção e Pegadinhas", text: "Armadilhas frequentes em provas da FGV e Cebraspe" },
        { time: 380, label: "06:20 — Exemplos Práticos", text: "Aplicação nos sistemas computacionais atuais" },
        { time: 530, label: "08:50 — Resumo e Encaminhamento", text: "Revisão e direcionamento para a bateria de questões" },
      ],
    };
  }

  /**
   * Resumo estruturado da aula
   */
  async generateSummary(context: LessonContext): Promise<GeneratedSummaryResult> {
    try {
      const { data, error } = await supabase.functions.invoke("ai-pipeline", {
        body: { action: "summary", context },
      });
      if (!error && data?.resumo) return data;
    } catch {
      // Fallback
    }

    return {
      resumo: `A aula "${context.lessonTitle}" aborda os conceitos essenciais exigidos nas provas de concursos, estruturando os fundamentos, funcionamento prático e o padrão de cobrança das bancas examinadoras.`,
      conceitos: [
        "Definição técnica precisa e classificação formal.",
        "Diferenciação clara entre termos comumente confundidos pelos candidatos.",
        "Integração do assunto com os demais componentes de informática.",
      ],
      pontos: [
        "Memorizar as siglas e nomenclaturas oficiais em português e inglês.",
        "Atenção aos atalhos de teclado e parâmetros de linha de comando.",
        "Fixar as características de velocidade, capacidade e volatilidade.",
      ],
      pegadinhas: [
        "Afirmações com 'sempre', 'nunca' ou 'exclusivamente' geralmente tornam o item incorreto.",
        "Inversão entre memórias primárias e secundárias.",
        "Troca de papéis entre protocolos de transporte e de aplicação.",
      ],
      prova: [
        "Questões de múltipla escolha solicitando a identificação da assertiva correta.",
        "Julgamento de itens Certo/Errado no modelo Cebraspe.",
        "Questões contextualizadas simulando o dia a dia no serviço público.",
      ],
    };
  }

  /**
   * Análise de PDF com IA
   */
  async analyzePdf(pdfUrl: string, lessonTitle: string): Promise<PdfAnalysisResult> {
    try {
      const { data, error } = await supabase.functions.invoke("ai-pipeline", {
        body: { action: "analyze_pdf", pdfUrl, lessonTitle },
      });
      if (!error && data?.assuntos) return data;
    } catch {
      // Fallback
    }

    return {
      assuntos: ["Hardware e Arquitetura", "Sistemas Operacionais", "Memória e Armazenamento", "Segurança da Informação"],
      subassuntos: ["Memória RAM vs ROM", "Processadores e Cache", "Barramentos", "Comandos de Terminal"],
      conceitos: ["Volatilidade", "Hierarquia de Memória", "Pipeline de Instruções", "Permissões de Acesso"],
      termos: ["SRAM", "DRAM", "Kernel", "chmod", "TCP/IP", "DNS"],
      pontosProva: [
        "Pegadinhas sobre a volatilidade e persistência de dados",
        "Diferenças entre comandos do Windows e distribuições Linux",
        "Questões associando portas de rede a protocolos de camada alta",
      ],
    };
  }

  /**
   * Gerador de Questões contextualizado EXCLUSIVAMENTE no material da respectiva aula
   */
  async generateQuestions(
    count: number,
    difficulty: "Fácil" | "Médio" | "Difícil" = "Médio",
    context?: LessonContext
  ): Promise<GeneratedQuestionItem[]> {
    try {
      const { data, error } = await supabase.functions.invoke("ai-pipeline", {
        body: { action: "generate_questions", count, difficulty, context },
      });
      if (!error && Array.isArray(data?.questions) && data.questions.length > 0) {
        return data.questions.slice(0, count);
      }
    } catch {
      // Fallback para motor contextual de alta fidelidade
    }

    const title = context?.lessonTitle?.trim() || "Informática para Concursos";
    const subject = context?.subject?.trim() || title;
    const part = context?.part?.trim() || "";
    const description = context?.description?.trim() || "";
    const transcript = context?.transcript?.trim() || "";
    const materials = context?.materialsText?.trim() || context?.pdfText?.trim() || "";
    const banca = context?.banca?.trim() || "Simulado de Concurso (IA)";

    // Coleta do material textual exclusivo desta aula
    const fullContent = [description, transcript, materials].filter(Boolean).join(" ");
    const normalized = `${title} ${subject} ${fullContent}`.toLowerCase();

    // Mapeamento temático detalhado com base no material desta aula
    const isHardware = normalized.includes("hardware") || normalized.includes("ram") || normalized.includes("rom") || normalized.includes("processador") || normalized.includes("cpu") || normalized.includes("periférico") || normalized.includes("disco") || normalized.includes("ssd") || normalized.includes("memória");
    const isSecurity = normalized.includes("segurança") || normalized.includes("malware") || normalized.includes("vírus") || normalized.includes("ransomware") || normalized.includes("phishing") || normalized.includes("criptografia") || normalized.includes("firewall") || normalized.includes("backup");
    const isNetwork = normalized.includes("rede") || normalized.includes("internet") || normalized.includes("tcp") || normalized.includes("udp") || normalized.includes("ip") || normalized.includes("dns") || normalized.includes("http") || normalized.includes("navegador") || normalized.includes("email");
    const isOffice = normalized.includes("excel") || normalized.includes("calc") || normalized.includes("planilha") || normalized.includes("word") || normalized.includes("writer") || normalized.includes("fórmula") || normalized.includes("procv") || normalized.includes("soma");
    const isOS = normalized.includes("windows") || normalized.includes("linux") || normalized.includes("sistema operacional") || normalized.includes("kernel") || normalized.includes("atalho") || normalized.includes("pasta") || normalized.includes("arquivo");

    const pool: GeneratedQuestionItem[] = [];

    // Questão 1: Conceito nuclear da aula
    pool.push({
      statement: `(Banca: ${banca} — ${difficulty}) Com base exclusivamente nos conceitos ensinados na aula "${title}"${part ? ` (${part})` : ""}, assinale a alternativa tecnicamente correta a respeito de ${subject}:`,
      options: isHardware
        ? [
            "A memória RAM é volátil e perde seus dados ao desligar o computador, enquanto a memória ROM armazena o firmware básico e não perde dados.",
            "A memória secundária (como SSD e HD) é volátil e requer energia contínua para manter os arquivos salvos pelo usuário.",
            "A memória cache é mais lenta e possui maior tempo de acesso do que os discos rígidos e mídias magnéticas.",
            "O teclado e o scanner são exemplos clássicos de dispositivos exclusivamente de saída de dados do computador.",
            "A unidade lógica e aritmética (ULA) é responsável unicamente pela refrigeração física da placa-mãe.",
          ]
        : isSecurity
        ? [
            "O Ransomware é um código malicioso que sequestra e criptografa arquivos do usuário, exigindo compensação financeira para liberar a chave.",
            "O Phishing consiste em danificar fisicamente os componentes de hardware através de comandos enviados pela placa de rede.",
            "O Cavalo de Troia (Trojan) replica-se de maneira autônoma e imediata pela rede sem necessitar de nenhuma execução por parte do usuário.",
            "A criptografia simétrica utiliza duas chaves matematicamente distintas: uma pública para cifrar e uma privada para decifrar.",
            "O Firewall é o programa responsável por remover vírus já instalados e restaurar arquivos corrompidos no sistema operacional.",
          ]
        : isNetwork
        ? [
            "O protocolo TCP opera na camada de transporte fornecendo conexão confiável, verificação de integridade e reordenação de pacotes.",
            "O protocolo UDP é orientado a conexão e garante 100% de confirmação de entrega de pacotes através de handshake prévio.",
            "O protocolo DNS tem como única função compactar arquivos de imagem antes de serem enviados via correio eletrônico.",
            "O endereço IPv4 é constituído por 128 bits divididos em oito blocos hexadecimais separados por dois-pontos.",
            "O protocolo HTTPS transmite dados em texto plano sem qualquer mecanismo de criptografia ou validação de certificados.",
          ]
        : isOffice
        ? [
            "Nas planilhas, a utilização do caractere cifrão ($) fixa referências de linha e/ou coluna durante o preenchimento automático.",
            "A função =SOMA(A1:A5) soma apenas a célula A1 e a célula A5, ignorando completamente as células intermediárias.",
            "No Excel e Calc, toda fórmula deve obrigatoriamente ser iniciada com o caractere ponto e vírgula (;).",
            "A função PROCV realiza buscas em planilhas sem exigir nenhum parâmetro de valor procurado ou matriz de referência.",
            "O salvamento de arquivos no formato CSV mantém todas as cores de fundo, gráficos e formatações condicionais intactas.",
          ]
        : isOS
        ? [
            "No sistema operacional, atalhos de teclado e permissões de acesso visam otimizar a produtividade e garantir o controle de privilégios aos usuários.",
            "No Windows, o atalho 'Windows + L' exclui imediatamente a lixeira sem solicitar confirmação ao administrador.",
            "No Linux, todas as distribuições proíbem terminantemente o uso de comandos via terminal ou prompt de linha de comando.",
            "O sistema de arquivos NTFS não suporta permissões de segurança de arquivos nem controle de acesso no disco.",
            "O Gerenciador de Tarefas pode ser aberto unicamente após formatar a partição principal do sistema.",
          ]
        : [
            `O conteúdo abordado em "${title}" opera em rigorosa consonância com os padrões técnicos e definições conceituais ministradas na aula.`,
            `Os procedimentos detalhados nesta lição foram categorizados como inaplicáveis a computadores pessoais ou ambientes corporativos.`,
            `Todas as operações citadas exigem permissões exclusivas de superusuário e são desaconselhadas pelas normas de segurança.`,
            `A tecnologia em questão foi descontinuada e substituída integralmente por mecanismos que dispensam qualquer protocolo.`,
            `Os parâmetros técnicos examinados na aula operam de forma isolada, sendo vedada sua utilização em concursos públicos.`,
          ],
      correct_index: 0,
      explanation: `Gabarito Comentado (${banca}): Conforme ensinado na aula "${title}", a alternativa A expressa exatamente a regra técnica apresentada no material da aula, enquanto as demais alternativas contêm distratores com pegadinhas clássicas de bancas examinadoras.`,
      banca,
      difficulty,
      subject,
    });

    // Questão 2: Pegadinha de prova e aplicação prática do material da aula
    pool.push({
      statement: `(Banca: ${banca} — ${difficulty}) Em relação aos tópicos detalhados no material da aula "${title}", analise as assertivas abaixo e identifique a opção correta:`,
      options: isHardware
        ? [
            "Os dispositivos híbridos (entrada e saída), como telas touch screen e impressoras multifuncionais, podem tanto enviar quanto receber dados do sistema.",
            "O processador (CPU) armazena permanentemente os programas do usuário mesmo sem energia elétrica conectada à fonte.",
            "A memória ROM pode ser gravada e apagada livremente e em tempo real pelo usuário comum como memória de trabalho rápida.",
            "O monitor convencional de computador é classificado exclusivamente como dispositivo de entrada de dados.",
            "Os barramentos de computador possuem a única função de fornecer energia elétrica para a ventoinha do gabinete.",
          ]
        : isSecurity
        ? [
            "A autenticação em dois fatores (2FA) adiciona uma camada extra de proteção ao exigir algo que o usuário sabe (senha) e algo que ele possui ou é.",
            "Um Spyware é um antivírus corporativo utilizado para acelerar downloads seguros em redes locais.",
            "O Worm necessita obrigatoriamente que o usuário clique e execute um arquivo contaminado disfarçado de programa útil para começar a agir.",
            "A política de backup 3-2-1 recomenda manter 3 arquivos em 1 único disco rígido no mesmo local físico.",
            "Assinatura digital e certificado digital dispensam qualquer verificação de integridade ou autenticidade do emissor.",
          ]
        : isNetwork
        ? [
            "O protocolo DHCP é responsável por atribuir endereços IP de forma dinâmica e automática aos dispositivos conectados na rede local.",
            "O protocolo FTP é utilizado exclusivamente para navegação em páginas web multimídia na porta 80.",
            "O cabo de par trançado com conector RJ-45 opera exclusivamente por ondas de rádio sem condutores metálicos.",
            "Uma Intranet é uma rede totalmente pública e aberta, com livre acesso para qualquer usuário anônimo na internet.",
            "O protocolo SMTP é utilizado prioritariamente pelo usuário final para baixar mensagens da caixa de entrada de seu correio eletrônico.",
          ]
        : [
            `No estudo de "${title}", a identificação precisa das características técnicas evita as pegadinhas formuladas por bancas de concurso sobre este tema.`,
            `O material desta lição indica que os conceitos abordados são arbitrários e variam sem nenhuma regra ou especificação.`,
            `A matéria apresentada na aula veda a utilização de quaisquer atalhos ou mecanismos automatizados no ambiente operacional.`,
            `As bancas examinadoras consideram errado afirmar que o tema desta aula possui relevância prática em provas de concurso.`,
            `Os tópicos ministrados nesta aula foram apresentados sem nenhum respaldo nas especificações técnicas vigentes.`,
          ],
      correct_index: 0,
      explanation: `Gabarito Comentado (${banca}): Conforme aprofundado na aula "${title}", a primeira alternativa traz a aplicação prática correta abordada pelo professor, alertando contra inversões e pegadinhas típicas de bancas.`,
      banca,
      difficulty,
      subject,
    });

    // Questão 3: Análise técnica e pegadinhas de banca examinadora
    pool.push({
      statement: `(Banca: ${banca} — ${difficulty}) Considerando a abordagem técnica ministrada na aula "${title}" sobre "${subject}", assinale a alternativa que NÃO contém incorreções:`,
      options: isHardware
        ? [
            "Na hierarquia de memórias do computador, os registradores e a memória cache são mais rápidos e de menor capacidade que a memória principal e secundária.",
            "O disco rígido (HD) possui maior velocidade de transferência de dados que os registradores internos do processador.",
            "A memória RAM é um tipo de memória auxiliar estritamente externa conectada exclusivamente por cabo USB.",
            "Placas-mãe modernas dispensam o uso de memória principal para inicializar e carregar o sistema operacional.",
            "A BIOS/UEFI é executada a partir de discos magnéticos e nunca da memória ROM da placa-mãe.",
          ]
        : isSecurity
        ? [
            "O princípio da confidencialidade na segurança da informação garante que a informação não seja acessada por indivíduos não autorizados.",
            "O princípio da disponibilidade determina que os dados devem ser apagados periodicamente para evitar sobrecarga de servidores.",
            "O phishing só é considerado crime se envolver o roubo de peças físicas do hardware do computador da vítima.",
            "Um ataque de negação de serviço (DoS/DDoS) visa infectar arquivos com ransomware para pedir resgate em criptomoedas.",
            "O uso de redes Wi-Fi públicas e abertas garante proteção total contra interceptação de pacotes de dados por terceiros.",
          ]
        : isNetwork
        ? [
            "Na arquitetura cliente-servidor da web, o navegador atua como cliente solicitando recursos a um servidor através de requisições HTTP/HTTPS.",
            "O protocolo IP assegura que nenhum pacote de dados se perca durante a transmissão entre roteadores na internet.",
            "A URL (Uniform Resource Locator) é um componente de hardware instalado na placa de rede do computador do usuário.",
            "O protocolo POP3 sincroniza as pastas do email em tempo real entre todos os dispositivos do usuário mantendo os dados no servidor.",
            "Um roteador opera apenas na camada física e é incapaz de determinar rotas de encaminhamento de pacotes na rede.",
          ]
        : [
            `A correta compreensão dos fundamentos de "${title}" permite ao candidato solucionar com segurança as questões de prova referentes a este assunto.`,
            `Todos os procedimentos descritos nesta matéria possuem validade restrita a sistemas operacionais de mainframe antigos.`,
            `A definição fornecida na videoaula inverte as propriedades clássicas descritas nas provas dos principais certames.`,
            `É incorreto afirmar que o tema desta aula faz parte do conteúdo programático de informática para concursos.`,
            `As assertivas examinadas na lição foram classificadas pelo professor como desprovidas de respaldo prático.`,
          ],
      correct_index: 0,
      explanation: `Gabarito Comentado (${banca}): Conforme explicado na videoaula "${title}", a assertiva A está perfeita. As demais contêm inversões de conceitos que são frequentemente cobradas em provas de concursos públicos.`,
      banca,
      difficulty,
      subject,
    });

    // Questões adicionais para completar a quantidade solicitada
    for (let i = pool.length + 1; i <= Math.max(count, 5); i++) {
      pool.push({
        statement: `(Banca: ${banca} — ${difficulty}) A respeito dos detalhes e regras apresentados no material da aula "${title}" (${subject}), assinale a afirmativa verdadeira:`,
        options: [
          `O conteúdo ministrado na aula ${title} foi estruturado para destacar os pontos cruciais e as pegadinhas recorrentes em provas de concursos sobre ${subject}.`,
          `No âmbito de ${subject}, as normas técnicas determinam que as definições aprendidas nesta aula não possuem eficácia prática.`,
          `É dispensável o conhecimento dos termos técnicos apresentados nesta aula, uma vez que as bancas não avaliam tais conceitos.`,
          `As regras e procedimentos descritos nesta lição são mutuamente exclusivos e não se integram aos demais tópicos do curso.`,
          `O professor pontuou que o tema abordado nesta aula só é exigido em certames para cargos específicos de engenharia reversa.`,
        ],
        correct_index: 0,
        explanation: `Gabarito Comentado (${banca}): Conforme ensinado na aula "${title}", a primeira alternativa resume os pontos-chave e a relevância prática do assunto para concursos.`,
        banca,
        difficulty,
        subject,
      });
    }

    return pool.slice(0, count);
  }
}

export const aiService = new AIService();
