import React, { useState, useEffect } from "react";
import {
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionContentProps {
  content?: string | null;
  className?: string;
  allowZoom?: boolean;
}

interface ImageBlock {
  type: "image";
  src: string;
  alt?: string;
}

interface TableBlock {
  type: "table";
  headers: string[];
  rows: string[][];
}

interface HtmlTableBlock {
  type: "html_table";
  html: string;
}

interface TextBlock {
  type: "text";
  text: string;
}

type ContentBlock = ImageBlock | TableBlock | HtmlTableBlock | TextBlock;

/**
 * Normaliza e resolve URLs de imagens, garantindo que caminhos relativos
 * do Supabase Storage ou uploads locais apontem para a origem correta,
 * e atualiza URLs HTTP inseguras para HTTPS quando aplicável.
 */
export function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  let clean = url.trim();

  // Remove aspas ou parênteses residuais
  clean = clean.replace(/^["'(\s]+|["')\s]+$/g, "");

  // Se for HTTP em página HTTPS, atualiza para HTTPS para evitar bloqueio de Mixed Content
  if (clean.startsWith("http://") && typeof window !== "undefined" && window.location.protocol === "https:") {
    clean = clean.replace(/^http:\/\//i, "https://");
  }

  const supabaseUrl = (
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    "https://cncopeoelyaqzmdwcknl.supabase.co"
  ).replace(/\/+$/, "");

  // Caminho relativo de storage do Supabase
  if (clean.startsWith("/storage/v1/")) {
    return `${supabaseUrl}${clean}`;
  }
  if (clean.startsWith("storage/v1/")) {
    return `${supabaseUrl}/${clean}`;
  }

  // Se já for URL absoluta (http, https, data URI)
  if (clean.startsWith("data:") || clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }

  // Se começar com barra simples (ex: /images/...)
  if (clean.startsWith("/")) {
    return clean;
  }

  // Caso o banco tenha apenas bucket e caminho (ex: questoes/figura1.png ou materiais/...)
  if (clean.includes("/") && !clean.includes("://")) {
    return `${supabaseUrl}/storage/v1/object/public/${clean}`;
  }

  return clean;
}

/**
 * Decodifica entidades HTML básicas caso o banco de dados armazene
 * tags com escape (ex: &lt;img src=&quot;...&quot;&gt;)
 */
function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Normaliza e analisa tabelas em markdown (tanto as padrões em múltiplas linhas
 * quanto as compactadas em linha única que usam "| |" como separador de linhas).
 */
function parseMarkdownTable(tableText: string): { headers: string[]; rows: string[][] } | null {
  // Converte separadores de linha compactados "| |" em quebras de linha reais
  const normalized = tableText.replace(/\|\s*\|/g, "|\n|");
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));

  if (lines.length < 2) return null;

  const rawRows: string[][] = lines.map((line) => {
    const inner = line.slice(1, -1);
    return inner.split("|").map((cell) => cell.trim());
  });

  // Localiza linha de separação (ex: | --- | --- |)
  const sepIndex = rawRows.findIndex((row) =>
    row.every((cell) => /^[-:\s]+$/.test(cell) || cell.length === 0)
  );

  let headers: string[] = [];
  let dataRows: string[][] = [];

  if (sepIndex > 0) {
    headers = rawRows[0];
    dataRows = rawRows.filter((_, idx) => idx !== sepIndex && idx !== 0);
  } else {
    headers = rawRows[0];
    dataRows = rawRows.slice(1);
  }

  // Ignora linhas totalmente vazias
  dataRows = dataRows.filter((row) => row.some((cell) => cell.length > 0));

  return { headers, rows: dataRows };
}

/**
 * Divide o conteúdo da questão em blocos sequenciais preservando a ordem exata:
 * Texto -> Imagem -> Texto -> Tabela -> Texto
 */
export function tokenizeContent(content: string): ContentBlock[] {
  if (!content) return [];

  // Decodifica entidades HTML que possam envolver tags de imagem
  const decodedContent = decodeHtmlEntities(content);
  const blocks: ContentBlock[] = [];
  let remaining = decodedContent;

  while (remaining.length > 0) {
    // 1. Tag HTML <img>
    const imgHtmlRegex = /<img\s+([^>]*?)>/i;
    // 2. Markdown ![alt](src)
    const imgMdRegex = /!\[([^\]]*)\]\(([^)]+)\)/i;
    // 3. Tabela HTML
    const htmlTableRegex = /<table[\s\S]*?<\/table>/i;
    // 4. Tabela Markdown
    const mdTableRegex = /(\|(?:[^\n\r|]+\|)+\r?\n\|(?:\s*:?-+:?\s*\|)+\r?\n(?:\|(?:[^\n\r|]+\|)*(?:\r?\n|$))+)|(\|[\s\S]*?\|\s*\|\s*---[\s\S]*?\|)/i;
    // 5. URL isolada de imagem (Cloudflare R2, Supabase Storage ou extensões comuns)
    const imgUrlRegex = /(?:^|\s)(https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:\?[^\s<>"']*)?)(?=$|\s)/i;
    const r2UrlRegex = /(?:^|\s)(https:\/\/[a-z0-9-]+\.r2\.dev\/questoes\/[^\s<>"']+)(?=$|\s)/i;

    const imgHtmlMatch = imgHtmlRegex.exec(remaining);
    const imgMdMatch = imgMdRegex.exec(remaining);
    const htmlTableMatch = htmlTableRegex.exec(remaining);
    const mdTableMatch = mdTableRegex.exec(remaining);
    const imgUrlMatch = imgUrlRegex.exec(remaining);
    const r2UrlMatch = r2UrlRegex.exec(remaining);

    type MatchCandidate = {
      type: "img_html" | "img_md" | "html_table" | "md_table" | "img_url" | "r2_url";
      index: number;
      length: number;
      match: RegExpExecArray;
    };

    const candidates: MatchCandidate[] = [];

    if (imgHtmlMatch) {
      candidates.push({ type: "img_html", index: imgHtmlMatch.index, length: imgHtmlMatch[0].length, match: imgHtmlMatch });
    }
    if (imgMdMatch) {
      candidates.push({ type: "img_md", index: imgMdMatch.index, length: imgMdMatch[0].length, match: imgMdMatch });
    }
    if (htmlTableMatch) {
      candidates.push({ type: "html_table", index: htmlTableMatch.index, length: htmlTableMatch[0].length, match: htmlTableMatch });
    }
    if (mdTableMatch) {
      candidates.push({ type: "md_table", index: mdTableMatch.index, length: mdTableMatch[0].length, match: mdTableMatch });
    }
    if (imgUrlMatch) {
      // Ajusta offset caso haja espaço capturado no início
      const leadingSpace = imgUrlMatch[0].startsWith(" ") ? 1 : 0;
      candidates.push({
        type: "img_url",
        index: imgUrlMatch.index + leadingSpace,
        length: imgUrlMatch[1].length,
        match: imgUrlMatch,
      });
    }
    if (r2UrlMatch) {
      const leadingSpace = r2UrlMatch[0].startsWith(" ") ? 1 : 0;
      candidates.push({
        type: "r2_url",
        index: r2UrlMatch.index + leadingSpace,
        length: r2UrlMatch[1].length,
        match: r2UrlMatch,
      });
    }

    if (candidates.length === 0) {
      // Nenhum bloco especial restante, adicionar todo o texto restante
      blocks.push({ type: "text", text: remaining });
      break;
    }

    // Selecionar o match que ocorre primeiro no texto
    candidates.sort((a, b) => a.index - b.index);
    const earliest = candidates[0];

    // Texto antes do bloco especial
    if (earliest.index > 0) {
      const textBefore = remaining.substring(0, earliest.index);
      blocks.push({ type: "text", text: textBefore });
    }

    // Processar o bloco especial
    if (earliest.type === "img_html") {
      const attrsStr = earliest.match[1] || "";
      const srcMatch = /src=(?:["']([^"']+)["']|([^\s>]+))/i.exec(attrsStr);
      const altMatch = /alt=(?:["']([^"']*)["']|([^\s>]+))/i.exec(attrsStr);
      const rawSrc = srcMatch ? (srcMatch[1] || srcMatch[2]) : "";

      if (rawSrc) {
        blocks.push({
          type: "image",
          src: normalizeImageUrl(rawSrc),
          alt: altMatch ? (altMatch[1] || altMatch[2]) : undefined,
        });
      } else {
        // Tag sem src válido, trata como texto
        blocks.push({ type: "text", text: earliest.match[0] });
      }
    } else if (earliest.type === "img_md") {
      const alt = earliest.match[1];
      const src = earliest.match[2];
      if (src) {
        blocks.push({ type: "image", src: normalizeImageUrl(src), alt });
      } else {
        blocks.push({ type: "text", text: earliest.match[0] });
      }
    } else if (earliest.type === "img_url" || earliest.type === "r2_url") {
      const rawUrl = earliest.match[1];
      if (rawUrl) {
        blocks.push({
          type: "image",
          src: normalizeImageUrl(rawUrl),
          alt: "Imagem da questão",
        });
      } else {
        blocks.push({ type: "text", text: earliest.match[0] });
      }
    } else if (earliest.type === "html_table") {
      blocks.push({ type: "html_table", html: earliest.match[0] });
    } else if (earliest.type === "md_table") {
      const parsed = parseMarkdownTable(earliest.match[0]);
      if (parsed) {
        blocks.push({ type: "table", headers: parsed.headers, rows: parsed.rows });
      } else {
        blocks.push({ type: "text", text: earliest.match[0] });
      }
    }

    remaining = remaining.substring(earliest.index + earliest.length);
  }

  return blocks;
}

/**
 * Renderiza textos preservando formatações comuns (negrito, itálico, quebras de linha e código).
 */
function FormattedInlineText({ text }: { text: string }) {
  if (!text) return null;

  // Normaliza tags básicas <br> em quebras de linha
  const normalized = text.replace(/<br\s*\/?>/gi, "\n");
  const paragraphs = normalized.split(/\n\n+/);

  return (
    <>
      {paragraphs.map((para, pIdx) => {
        const lines = para.split(/\n/);
        return (
          <p key={pIdx} className={cn("leading-relaxed", pIdx > 0 && "mt-2.5")}>
            {lines.map((line, lIdx) => {
              // Decodifica entidades comuns e processa negrito / itálico inline
              const formattedLine = parseInlineStyles(line);
              return (
                <React.Fragment key={lIdx}>
                  {formattedLine}
                  {lIdx < lines.length - 1 && <br />}
                </React.Fragment>
              );
            })}
          </p>
        );
      })}
    </>
  );
}

/**
 * Converte marcações simples de negrito (**texto**, <b>, <strong>) e itálico em elementos React
 */
function parseInlineStyles(text: string): React.ReactNode {
  if (!text) return null;

  // Substitui tags HTML básicas de formatação para markdown unificado
  let processed = text
    .replace(/<(b|strong)>(.*?)<\/\1>/gi, "**$2**")
    .replace(/<(i|em)>(.*?)<\/\1>/gi, "*$2*")
    .replace(/<code>(.*?)<\/code>/gi, "`$1`");

  // Divide por tokens markdown: **bold**, *italic*, `code`
  const parts = processed.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={index} className="italic text-foreground/90">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          className="rounded bg-secondary/80 px-1.5 py-0.5 font-mono text-[11px] text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Componente de Imagem Interativa com Lightbox / Zoom, alta nitidez e tratamento de erros.
 */
export function QuestionImage({
  src,
  alt,
  allowZoom = true,
}: {
  src: string;
  alt?: string;
  allowZoom?: boolean;
}) {
  const normalizedSrc = normalizeImageUrl(src);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Fecha o lightbox ao pressionar Escape
  useEffect(() => {
    if (!isZoomed) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsZoomed(false);
        setZoomScale(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZoomed]);

  // Impede rolagem do fundo quando modal de zoom estiver aberto
  useEffect(() => {
    if (isZoomed) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isZoomed]);

  if (!normalizedSrc) return null;

  if (hasError) {
    return (
      <div className="my-4 flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        <ImageIcon className="size-5 shrink-0 text-muted-foreground" />
        <div className="flex-1 truncate">
          <p className="font-semibold text-foreground">Imagem da questão (anexo)</p>
          <p className="text-[11px] text-muted-foreground truncate">{normalizedSrc}</p>
        </div>
        <a
          href={normalizedSrc}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold shrink-0"
        >
          Abrir imagem externa <ExternalLink className="size-3" />
        </a>
      </div>
    );
  }

  return (
    <>
      <figure className="my-4 flex flex-col items-center select-none w-full">
        <div
          className={cn(
            "group relative max-w-full rounded-2xl border border-border/80 bg-white dark:bg-zinc-900/90 p-2 sm:p-3 shadow-sm transition-all hover:border-primary/50 hover:shadow-md",
            allowZoom && "cursor-zoom-in"
          )}
          onClick={() => {
            if (allowZoom) {
              setZoomScale(1);
              setIsZoomed(true);
            }
          }}
        >
          {/* Skeleton enquanto carrega - sem ocultar o elemento <img> da renderização do navegador */}
          {isLoading && (
            <div className="flex h-36 w-64 items-center justify-center text-xs text-muted-foreground animate-pulse rounded-xl bg-secondary/40 mx-auto">
              <Loader2 className="size-4 animate-spin text-primary mr-2" />
              Carregando imagem...
            </div>
          )}

          <img
            src={normalizedSrc}
            alt={alt || "Imagem da questão"}
            decoding="async"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            className={cn(
              "max-h-[480px] w-auto max-w-full rounded-xl object-contain transition-all duration-300 group-hover:scale-[1.01]",
              isLoading ? "opacity-0 absolute inset-0 pointer-events-none" : "opacity-100"
            )}
          />

          {allowZoom && !isLoading && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomScale(1);
                  setIsZoomed(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/75 hover:bg-black text-white text-[11px] font-semibold shadow-md backdrop-blur-sm cursor-pointer transition-colors"
                title="Ampliar imagem (zoom)"
              >
                <ZoomIn className="size-3.5" />
                <span>Ampliar</span>
              </button>
            </div>
          )}
        </div>

        {alt && alt !== "Imagem da questão" && (
          <figcaption className="mt-2 text-center text-xs text-muted-foreground italic max-w-xl">
            {alt}
          </figcaption>
        )}
      </figure>

      {/* LIGHTBOX MODAL COM ZOOM INTERATIVO */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn"
          onClick={() => {
            setIsZoomed(false);
            setZoomScale(1);
          }}
        >
          {/* Barra de Ferramentas Superior */}
          <div
            className="absolute top-4 right-4 flex items-center gap-2 z-10 bg-zinc-900/90 border border-zinc-700/80 rounded-xl px-3 py-1.5 shadow-xl text-white text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomScale((prev) => Math.min(3.5, prev + 0.25))}
              className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
              title="Aumentar zoom (+)"
            >
              <ZoomIn className="size-4" />
            </button>
            <span className="font-mono text-[11px] font-bold px-1 text-zinc-300">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomScale((prev) => Math.max(0.5, prev - 0.25))}
              className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
              title="Diminuir zoom (-)"
            >
              <ZoomOut className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomScale(1)}
              className="p-1 rounded hover:bg-white/10 transition-colors text-[11px] font-semibold cursor-pointer"
              title="Redefinir zoom (100%)"
            >
              <RotateCcw className="size-3.5" />
            </button>
            <div className="h-4 w-px bg-zinc-700 mx-1" />
            <a
              href={normalizedSrc}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded hover:bg-white/10 transition-colors inline-flex items-center gap-1 cursor-pointer"
              title="Abrir imagem original em nova aba"
            >
              <ExternalLink className="size-3.5" />
            </a>
            <button
              type="button"
              onClick={() => {
                setIsZoomed(false);
                setZoomScale(1);
              }}
              className="p-1 rounded hover:bg-red-500/80 transition-colors text-zinc-300 hover:text-white cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Imagem Ampliada */}
          <div
            className="overflow-auto max-h-[88vh] max-w-[92vw] flex items-center justify-center p-4 cursor-default select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={normalizedSrc}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              decoding="async"
              alt={alt || "Imagem da questão"}
              style={{
                transform: `scale(${zoomScale})`,
                transition: "transform 0.15s ease-out",
                cursor: zoomScale > 1 ? "grab" : "zoom-in",
              }}
              onClick={() => {
                setZoomScale((prev) => (prev === 1 ? 1.75 : 1));
              }}
              className="rounded-xl shadow-2xl max-h-[82vh] max-w-[88vw] object-contain bg-white dark:bg-zinc-900 p-2 border border-zinc-700"
            />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Renderizador de Tabelas Estilizadas e Responsivas
 */
function QuestionTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full text-left border-collapse text-xs sm:text-sm">
        {headers && headers.length > 0 && (
          <thead className="bg-secondary/80 border-b border-border text-foreground font-bold">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-2.5 font-bold tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className="border-t border-border/60 transition-colors even:bg-secondary/20 hover:bg-secondary/40"
            >
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-4 py-2.5 text-foreground/90 font-mono sm:font-sans">
                  {cell || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Componente Principal QuestionContent
 * Renderiza o enunciado, alternativa ou comentário com total suporte a:
 * - Imagens <img> e Markdown ![alt](src) com lightbox zoom
 * - Tabelas Markdown e HTML
 * - Formatações tipográficas (negrito, itálico, código, quebras)
 */
export function QuestionContent({ content, className, allowZoom = true }: QuestionContentProps) {
  if (!content) return null;

  const blocks = tokenizeContent(content);

  return (
    <div className={cn("space-y-2", className)}>
      {blocks.map((block, idx) => {
        if (block.type === "image") {
          return <QuestionImage key={idx} src={block.src} alt={block.alt} allowZoom={allowZoom} />;
        }
        if (block.type === "table") {
          return <QuestionTable key={idx} headers={block.headers} rows={block.rows} />;
        }
        if (block.type === "html_table") {
          return (
            <div
              key={idx}
              className="my-4 overflow-x-auto rounded-xl border border-border bg-card shadow-sm p-2 text-xs sm:text-sm [&_table]:w-full [&_table]:border-collapse [&_th]:bg-secondary/80 [&_th]:p-2.5 [&_th]:border-b [&_th]:border-border [&_td]:p-2.5 [&_td]:border-t [&_td]:border-border/60"
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          );
        }
        return <FormattedInlineText key={idx} text={block.text} />;
      })}
    </div>
  );
}
