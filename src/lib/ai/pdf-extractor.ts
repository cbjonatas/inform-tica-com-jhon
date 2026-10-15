/**
 * Extrator leve e autônomo de texto de arquivos PDF.
 * Executa nativamente no navegador ou em runtime JS utilizando DecompressionStream
 * para descompactar fluxos /FlateDecode e decodificar operadores textuais do PDF (BT...ET, Tj, TJ).
 */

/**
 * Descomprime bytes comprimidos em zlib/deflate RFC 1950 ou raw deflate.
 */
async function decompressFlate(bytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === "undefined") {
    return new TextDecoder("latin1").decode(bytes);
  }

  try {
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(bytes as any);
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
    return new TextDecoder("latin1").decode(out);
  } catch {
    try {
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      writer.write(bytes as any);
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
      return new TextDecoder("latin1").decode(out);
    } catch {
      return new TextDecoder("latin1").decode(bytes);
    }
  }
}

/**
 * Decodifica sequências de escape em literais de PDF (ex: \n, \r, \ddd, \(, \)).
 */
function decodePdfLiteral(raw: string): string {
  return raw
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

/**
 * Decodifica sequências hexadecimais de PDF (<48656c6c6f>).
 */
function decodePdfHex(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  if (clean.length % 2 !== 0) return "";
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    try {
      return new TextDecoder("utf-16be").decode(bytes.subarray(2));
    } catch {
      // fallback
    }
  }
  return new TextDecoder("latin1").decode(bytes);
}

/**
 * Extrai trechos de texto de um fluxo descompactado inspecionando blocos BT ... ET.
 */
function extractTextFromStream(content: string): string[] {
  const textPieces: string[] = [];
  const btEtRegex = /BT[\s\S]*?ET/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = btEtRegex.exec(content)) !== null) {
    const block = blockMatch[0];

    // Formato 1: (String) Tj, ', "
    const tjRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
    let m: RegExpExecArray | null;
    while ((m = tjRegex.exec(block)) !== null) {
      const decoded = decodePdfLiteral(m[1]);
      if (decoded.trim()) textPieces.push(decoded.trim());
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
          stringParts.push(decodePdfLiteral(itemMatch[1]));
        } else if (itemMatch[2] !== undefined) {
          stringParts.push(decodePdfHex(itemMatch[2]));
        }
      }
      const joined = stringParts.join("").trim();
      if (joined) textPieces.push(joined);
    }

    // Formato 3: <Hex> Tj
    const hexRegex = /<([0-9a-fA-F]+)>\s*(?:Tj|'|")/g;
    while ((m = hexRegex.exec(block)) !== null) {
      const decoded = decodePdfHex(m[1]);
      if (decoded.trim()) textPieces.push(decoded.trim());
    }
  }

  return textPieces;
}

/**
 * Processa um ArrayBuffer de PDF e extrai todo o texto contido nos fluxos do documento.
 */
export async function extractTextFromPdfBuffer(buffer: ArrayBuffer): Promise<string> {
  try {
    const uint8 = new Uint8Array(buffer);
    const latin1String = new TextDecoder("latin1").decode(uint8);
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    const pieces: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = streamRegex.exec(latin1String)) !== null) {
      const streamStart = match.index + match[0].indexOf("\n") + 1;
      const streamEnd = match.index + match[0].lastIndexOf("endstream");
      if (streamStart >= streamEnd) continue;

      const preceding = latin1String.substring(Math.max(0, match.index - 500), match.index);
      const isFlate = preceding.includes("/FlateDecode");

      const streamBytes = uint8.subarray(streamStart, streamEnd);
      let streamText = "";
      if (isFlate) {
        streamText = await decompressFlate(streamBytes);
      } else {
        streamText = new TextDecoder("latin1").decode(streamBytes);
      }

      if (streamText) {
        const textInStream = extractTextFromStream(streamText);
        if (textInStream.length > 0) {
          pieces.push(...textInStream);
        }
      }
    }

    const fullText = pieces.join(" ").replace(/\s+/g, " ").trim();
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
