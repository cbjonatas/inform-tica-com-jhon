/**
 * Extrator avançado e autônomo de texto de arquivos PDF.
 * Suporta biblioteca PDF.js via CDN no navegador com fallback para parser nativo
 * em TypeScript, com descompressão FlateDecode, suporte a ToUnicode CMap,
 * correção de Mojibake e eliminação rigorosa de caracteres não legíveis e bytes nulos.
 */

/**
 * Higieniza e normaliza o texto extraído, corrigindo Mojibake e removendo caracteres inválidos.
 */
export function cleanAndNormalizeText(str: string): string {
  if (!str) return "";

  // 1. Corrigir sequências comuns de Mojibake (UTF-8 interpretado como ISO-8859-1 ou WinAnsi)
  let text = str
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã£/g, "ã")
    .replace(/Ãµ/g, "õ")
    .replace(/Ã§/g, "ç")
    .replace(/Ã¢/g, "â")
    .replace(/Ãª/g, "ê")
    .replace(/Ã´/g, "ô")
    .replace(/Ã /g, "à")
    .replace(/Ã/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã/g, "Í")
    .replace(/Ã“/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ãƒ/g, "Ã")
    .replace(/Ã•/g, "Õ")
    .replace(/Ã‡/g, "Ç")
    .replace(/Ã‚/g, "Â")
    .replace(/ÃŠ/g, "Ê")
    .replace(/Ã”/g, "Ô")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€˜/g, "'")
    .replace(/â€™/g, "'")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€¢/g, "•")
    .replace(/Â°/g, "°")
    .replace(/Âº/g, "º")
    .replace(/Âª/g, "ª");

  // 2. Tentar decodificação genérica de Mojibake se ainda existirem sequências de 2 bytes
  try {
    if (/[\u00C2-\u00C3][\u0080-\u00BF]/.test(text)) {
      const bytes = new Uint8Array([...text].map((c) => c.charCodeAt(0) & 0xff));
      const candidate = new TextDecoder("utf-8").decode(bytes);
      if (!candidate.includes("\ufffd") && candidate.length > 0) {
        text = candidate;
      }
    }
  } catch {}

  // 3. Remover caracteres de controle e bytes nulos não imprimíveis
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD]/g, " ");

  // 4. Corrigir quebras de linha com hífens (ex: "progra-\nma" -> "programa")
  text = text.replace(/(\w+)-\s*[\r\n]+\s*(\w+)/g, "$1$2");

  // 5. Normalizar espaços múltiplos e espaços ao redor de pontuação
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\s+([,.;:!?])/g, "$1");

  return text.trim();
}

let pdfJsPromise: Promise<any> | null = null;

/**
 * Tenta carregar o PDF.js dinamicamente caso executado em ambiente de navegador.
 */
async function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  if (pdfJsPromise) return pdfJsPromise;

  pdfJsPromise = new Promise((resolve) => {
    try {
      const existing = document.querySelector('script[data-pdfjs="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve((window as any).pdfjsLib || null));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.setAttribute("data-pdfjs", "true");
      script.async = true;
      script.onload = () => {
        const pdfjs = (window as any).pdfjsLib;
        if (pdfjs) {
          pdfjs.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        resolve(pdfjs || null);
      };
      script.onerror = () => resolve(null);
      document.head.appendChild(script);

      // Limite de espera de 3.5 segundos para fallback automático
      setTimeout(() => resolve((window as any).pdfjsLib || null), 3500);
    } catch {
      resolve(null);
    }
  });

  return pdfJsPromise;
}

/**
 * Descomprime bytes comprimidos em zlib/deflate RFC 1950 ou raw deflate.
 */
async function decompressFlate(bytes: Uint8Array): Promise<string> {
  // Ajustar início caso o cabeçalho zlib (0x78) não esteja no índice 0
  let startOffset = 0;
  for (let i = 0; i < Math.min(bytes.length, 16); i++) {
    if (bytes[i] === 0x78) {
      startOffset = i;
      break;
    }
  }
  const cleanBytes = startOffset > 0 ? bytes.subarray(startOffset) : bytes;

  if (typeof DecompressionStream === "undefined") {
    return new TextDecoder("latin1").decode(cleanBytes);
  }

  try {
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(cleanBytes as any);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    // Tenta decodificar como UTF-8 primeiro
    try {
      const utf8Str = new TextDecoder("utf-8", { fatal: true }).decode(out);
      return utf8Str;
    } catch {
      return new TextDecoder("latin1").decode(out);
    }
  } catch {
    try {
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      writer.write(cleanBytes as any);
      writer.close();
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      const out = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(out);
      } catch {
        return new TextDecoder("latin1").decode(out);
      }
    } catch {
      return new TextDecoder("latin1").decode(cleanBytes);
    }
  }
}

/**
 * Decodifica literais de PDF, tratando octal, UTF-16BE e caracteres de escape.
 */
function decodePdfLiteral(raw: string, cMap?: Map<string, string>): string {
  // Se contiver marcador UTF-16BE \376\377 ou \xFE\xFF
  if (raw.startsWith("\xfe\xff") || raw.startsWith("\\376\\377")) {
    const cleanRaw = raw.replace(/^(\xfe\xff|\\376\\377)/, "");
    const bytes: number[] = [];
    let i = 0;
    while (i < cleanRaw.length) {
      if (cleanRaw[i] === "\\" && /[0-7]/.test(cleanRaw[i + 1])) {
        const octMatch = cleanRaw.slice(i + 1).match(/^[0-7]{1,3}/);
        if (octMatch) {
          bytes.push(parseInt(octMatch[0], 8));
          i += 1 + octMatch[0].length;
          continue;
        }
      }
      bytes.push(cleanRaw.charCodeAt(i));
      i++;
    }
    try {
      return new TextDecoder("utf-16be").decode(new Uint8Array(bytes));
    } catch {}
  }

  // Desfazer escapes de octal e caracteres especiais
  let unescaped = raw
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");

  // Se houver bytes nulos alternados (UTF-16BE sem BOM)
  if (unescaped.includes("\x00")) {
    const bytes = new Uint8Array([...unescaped].map((c) => c.charCodeAt(0) & 0xff));
    try {
      const u16 = new TextDecoder("utf-16be").decode(bytes);
      if (u16 && !u16.includes("\ufffd")) {
        return u16;
      }
    } catch {}
    unescaped = unescaped.replace(/\x00/g, "");
  }

  return cleanAndNormalizeText(unescaped);
}

/**
 * Decodifica sequências hexadecimais de PDF (<48656c6c6f>).
 */
function decodePdfHex(hex: string, cMap?: Map<string, string>): string {
  const clean = hex.replace(/\s+/g, "");
  if (!clean || clean.length % 2 !== 0) return "";

  // Se houver mapa ToUnicode, tentar traduzir códigos de 4 ou 2 dígitos
  if (cMap && cMap.size > 0) {
    if (clean.length % 4 === 0) {
      let mapped = "";
      let allMapped = true;
      for (let i = 0; i < clean.length; i += 4) {
        const code = clean.substring(i, i + 4).toLowerCase();
        if (cMap.has(code)) {
          mapped += cMap.get(code);
        } else {
          allMapped = false;
          break;
        }
      }
      if (allMapped && mapped.length > 0) return cleanAndNormalizeText(mapped);
    }
  }

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }

  // UTF-16BE com BOM
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    try {
      return cleanAndNormalizeText(new TextDecoder("utf-16be").decode(bytes.subarray(2)));
    } catch {}
  }

  // UTF-16BE sem BOM (detecta se byte 0 é 0x00 e byte 1 é letra ASCII)
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] >= 0x20 && bytes[2] === 0x00) {
    try {
      return cleanAndNormalizeText(new TextDecoder("utf-16be").decode(bytes));
    } catch {}
  }

  // Tentar UTF-8 e Latin1
  try {
    const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return cleanAndNormalizeText(utf8);
  } catch {
    return cleanAndNormalizeText(new TextDecoder("latin1").decode(bytes));
  }
}

/**
 * Extrai mapeamento ToUnicode CMap para decodificar fontes subsetadas.
 */
function extractToUnicodeCMap(content: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!content.includes("/CIDInit")) return map;

  // 1. beginbfchar
  const bfCharRegex = /beginbfchar[\s\r\n]+([\s\S]*?)endbfchar/g;
  let match: RegExpExecArray | null;
  while ((match = bfCharRegex.exec(content)) !== null) {
    const block = match[1];
    const pairRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let p: RegExpExecArray | null;
    while ((p = pairRegex.exec(block)) !== null) {
      const src = p[1].toLowerCase();
      const dstHex = p[2];
      try {
        const codePoint = parseInt(dstHex, 16);
        map.set(src, String.fromCodePoint(codePoint));
      } catch {}
    }
  }

  // 2. beginbfrange
  const bfRangeRegex = /beginbfrange[\s\r\n]+([\s\S]*?)endbfrange/g;
  while ((match = bfRangeRegex.exec(content)) !== null) {
    const block = match[1];
    const rangeRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let r: RegExpExecArray | null;
    while ((r = rangeRegex.exec(block)) !== null) {
      const start = parseInt(r[1], 16);
      const end = parseInt(r[2], 16);
      const dstStart = parseInt(r[3], 16);
      for (let c = start; c <= end; c++) {
        const srcCode = c.toString(16).padStart(r[1].length, "0").toLowerCase();
        const dstCode = dstStart + (c - start);
        try {
          map.set(srcCode, String.fromCodePoint(dstCode));
        } catch {}
      }
    }
  }

  return map;
}

/**
 * Extrai trechos de texto de um fluxo descompactado inspecionando blocos BT ... ET.
 */
function extractTextFromStream(content: string, cMap?: Map<string, string>): string[] {
  const textPieces: string[] = [];
  const btEtRegex = /BT[\s\S]*?ET/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = btEtRegex.exec(content)) !== null) {
    const block = blockMatch[0];

    // Formato 1: (String) Tj, ', "
    const tjRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
    let m: RegExpExecArray | null;
    while ((m = tjRegex.exec(block)) !== null) {
      const decoded = decodePdfLiteral(m[1], cMap);
      if (decoded && decoded.trim().length > 0) {
        textPieces.push(decoded.trim());
      }
    }

    // Formato 2: [(String) -120 (Other String)] TJ
    const arrayTjRegex = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = arrayTjRegex.exec(block)) !== null) {
      const insideArray = m[1];
      const stringParts: string[] = [];
      const itemRegex = /\(([\s\S]*?)\)|<([0-9a-fA-F]+)>/g;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemRegex.exec(insideArray)) !== null) {
        if (itemMatch[1] !== undefined) {
          stringParts.push(decodePdfLiteral(itemMatch[1], cMap));
        } else if (itemMatch[2] !== undefined) {
          stringParts.push(decodePdfHex(itemMatch[2], cMap));
        }
      }
      const joined = cleanAndNormalizeText(stringParts.join(""));
      if (joined && joined.length > 0) {
        textPieces.push(joined);
      }
    }

    // Formato 3: <Hex> Tj
    const hexRegex = /<([0-9a-fA-F]+)>\s*(?:Tj|'|")/g;
    while ((m = hexRegex.exec(block)) !== null) {
      const decoded = decodePdfHex(m[1], cMap);
      if (decoded && decoded.trim().length > 0) {
        textPieces.push(decoded.trim());
      }
    }
  }

  return textPieces;
}

/**
 * Processa um ArrayBuffer de PDF e extrai todo o texto do documento.
 * Utiliza o motor PDF.js se disponível, com fallback robusto nativo.
 */
export async function extractTextFromPdfBuffer(buffer: ArrayBuffer): Promise<string> {
  // 1. Tentar primeiro extração profissional via PDF.js (se em navegador)
  try {
    const pdfjs = await loadPdfJs();
    if (pdfjs && pdfjs.getDocument) {
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        isEvalSupported: false,
      });
      const pdf = await loadingTask.promise;
      const pagesText: string[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageStrings = textContent.items
          .map((item: any) => item.str || "")
          .filter((str: string) => str.trim().length > 0);

        if (pageStrings.length > 0) {
          pagesText.push(pageStrings.join(" "));
        }
      }

      const combined = cleanAndNormalizeText(pagesText.join("\n\n"));
      if (combined && combined.length > 30) {
        return combined;
      }
    }
  } catch (pdfJsErr) {
    console.warn("Aviso: fallback para extrator nativo devido a:", pdfJsErr);
  }

  // 2. Extrator nativo robusto (fallback sem dependências externas)
  try {
    const uint8 = new Uint8Array(buffer);
    const latin1String = new TextDecoder("latin1").decode(uint8);

    // Identificar e montar mapas ToUnicode
    const globalCMap = new Map<string, string>();
    const cMapRegex = /stream[\r\n]+([\s\S]*?CIDInit[\s\S]*?)[\r\n]+endstream/g;
    let cmMatch: RegExpExecArray | null;
    while ((cmMatch = cMapRegex.exec(latin1String)) !== null) {
      const cmText = cmMatch[1];
      const parsed = extractToUnicodeCMap(cmText);
      for (const [k, v] of parsed.entries()) {
        globalCMap.set(k, v);
      }
    }

    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    const pieces: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = streamRegex.exec(latin1String)) !== null) {
      // Pular estritamente streams de imagem, fontes binárias, metadados ou tabelas xref
      const preceding = latin1String.substring(Math.max(0, match.index - 600), match.index);
      const isImageOrFont =
        /\/Subtype\s*\/\s*(?:Image|CIDFontType|Type1C)/i.test(preceding) ||
        /\/Type\s*\/\s*(?:Font|XObject|Metadata|ObjStm|XRef)/i.test(preceding) ||
        /\/FontFile[123]?\b/i.test(preceding) ||
        /\/Filter\s*\/\s*(?:DCTDecode|JPXDecode|JBIG2Decode|CCITTFaxDecode)/i.test(preceding);

      if (isImageOrFont) {
        continue;
      }

      // Calcular offset exato dos bytes do stream
      let streamStart = match.index + 6; // 'stream' tem 6 caracteres
      if (latin1String[streamStart] === "\r") streamStart++;
      if (latin1String[streamStart] === "\n") streamStart++;

      const streamEnd = match.index + match[0].lastIndexOf("endstream");
      if (streamStart >= streamEnd) continue;

      const isFlate = preceding.includes("/FlateDecode");
      const streamBytes = uint8.subarray(streamStart, streamEnd);

      let streamText = "";
      if (isFlate) {
        streamText = await decompressFlate(streamBytes);
      } else {
        streamText = new TextDecoder("latin1").decode(streamBytes);
      }

      if (streamText) {
        // Verificar se descompressão revelou mapa ToUnicode
        if (streamText.includes("/CIDInit")) {
          const innerCMap = extractToUnicodeCMap(streamText);
          for (const [k, v] of innerCMap.entries()) {
            globalCMap.set(k, v);
          }
        }

        const textInStream = extractTextFromStream(streamText, globalCMap);
        if (textInStream.length > 0) {
          pieces.push(...textInStream);
        }
      }
    }

    // Se nenhum stream BT..ET foi encontrado, tentar extrair texto direto
    if (pieces.length === 0) {
      const fallbackPieces = extractTextFromStream(latin1String, globalCMap);
      if (fallbackPieces.length > 0) {
        pieces.push(...fallbackPieces);
      }
    }

    const fullText = cleanAndNormalizeText(pieces.join(" \n"));
    return fullText;
  } catch (err) {
    console.warn("Falha na extração de texto do PDF:", err);
    return "";
  }
}

/**
 * Busca o arquivo PDF através de uma URL e extrai o texto do seu conteúdo.
 */
export async function extractTextFromPdfUrl(pdfUrl: string): Promise<string> {
  if (!pdfUrl || typeof pdfUrl !== "string" || !pdfUrl.startsWith("http")) {
    return "";
  }
  try {
    const res = await fetch(pdfUrl);
    if (!res.ok) return "";
    const buf = await res.arrayBuffer();
    return await extractTextFromPdfBuffer(buf);
  } catch (err) {
    console.warn("Erro ao buscar PDF para extração:", err);
    return "";
  }
}
