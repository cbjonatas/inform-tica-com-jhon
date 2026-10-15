import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
} from "react";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface VideoPlayerRef {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
}

interface VideoPlayerProps {
  src: string;
  initialPosition?: number;
  onTimeUpdateThrottled?: (currentTime: number) => void;
  onEnded?: () => void;
  className?: string;
}

export type VideoSourceType = "direct" | "google-drive" | "youtube" | "vimeo" | "folder";

export interface ParsedVideoSource {
  type: VideoSourceType;
  rawUrl: string;
  embedUrl?: string;
  fileId?: string;
  error?: string;
}

/**
 * Extrai o ID de um arquivo no Google Drive a partir de qualquer formato de link conhecido:
 * - https://drive.google.com/file/d/{id}/view?usp=sharing
 * - https://drive.google.com/file/d/{id}/view
 * - https://drive.google.com/file/d/{id}/preview
 * - https://drive.google.com/file/u/0/d/{id}/view
 * - https://drive.google.com/open?id={id}
 * - https://drive.google.com/uc?id={id}&export=download
 * - <iframe src="https://drive.google.com/file/d/{id}/preview" ...></iframe>
 */
export function extractGoogleDriveId(url?: string | null): string | null {
  if (!url) return null;
  const str = url.trim();

  // Se o usuário colou a tag iframe completa
  const iframeMatch = str.match(/<iframe.*?src=["']([^"']+)["']/i);
  const target = iframeMatch && iframeMatch[1] ? iframeMatch[1].trim() : str;

  // 1. /d/{id} (captura /file/d/{id}, /file/u/0/d/{id}, /u/1/d/{id}, /d/{id})
  const dMatch = target.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
  if (dMatch && dMatch[1]) return dMatch[1];

  // 2. id={id} (captura ?id=..., &id=...)
  const idMatch = target.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (idMatch && idMatch[1]) return idMatch[1];

  // 3. /file/d/{id} explícito
  const fileMatch = target.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) return fileMatch[1];

  // 4. Se o usuário inseriu diretamente o ID alfanumérico do Google Drive (25 a 55 caracteres)
  if (/^[a-zA-Z0-9_-]{25,55}$/.test(target)) {
    return target;
  }

  return null;
}

/**
 * Analisa a URL do vídeo e retorna a estratégia ideal de reprodução:
 * - Google Drive: iframe embed oficial /preview (sem tela preta, com suporte a qualquer tamanho de vídeo)
 * - YouTube: iframe embed sem cookies
 * - Vimeo: iframe player embed
 * - Pasta do Google Drive: aviso amigável
 * - Arquivo direto: HTML5 <video> nativo de alta performance
 */
export function parseVideoSource(src?: string | null): ParsedVideoSource {
  if (!src || !src.trim()) {
    return {
      type: "direct",
      rawUrl: "",
    };
  }

  let cleaned = src.trim();

  // Limpeza de iframe se colado
  const iframeMatch = cleaned.match(/<iframe.*?src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    cleaned = iframeMatch[1].trim();
  }

  // 1. Verificar se é uma pasta do Google Drive
  if (cleaned.includes("drive.google.com/drive/folders/") || cleaned.includes("/folders/")) {
    const folderMatch = cleaned.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return {
      type: "folder",
      rawUrl: cleaned,
      fileId: folderMatch?.[1] || "",
      error: "O link informado é de uma pasta do Google Drive. Por favor, forneça o link de compartilhamento do arquivo de vídeo individual.",
    };
  }

  // 2. Google Drive
  const isGoogleDrive =
    cleaned.includes("drive.google.com") ||
    cleaned.includes("docs.google.com") ||
    cleaned.includes("drive.usercontent.google.com");

  const driveId = extractGoogleDriveId(cleaned);

  if (isGoogleDrive || driveId) {
    if (driveId) {
      return {
        type: "google-drive",
        rawUrl: cleaned,
        fileId: driveId,
        embedUrl: `https://drive.google.com/file/d/${driveId}/preview`,
      };
    }
  }

  // 3. YouTube
  const isYouTube = cleaned.includes("youtube.com") || cleaned.includes("youtu.be");
  if (isYouTube) {
    const ytMatch = cleaned.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    if (ytMatch && ytMatch[1]) {
      return {
        type: "youtube",
        rawUrl: cleaned,
        fileId: ytMatch[1],
        embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0`,
      };
    }
  }

  // 4. Vimeo
  const isVimeo = cleaned.includes("vimeo.com");
  if (isVimeo) {
    const vimeoMatch = cleaned.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    if (vimeoMatch && vimeoMatch[1]) {
      return {
        type: "vimeo",
        rawUrl: cleaned,
        fileId: vimeoMatch[1],
        embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
      };
    }
  }

  // 5. Arquivo direto padrão (MP4, WebM, Supabase Storage, CDN)
  return {
    type: "direct",
    rawUrl: cleaned,
  };
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ src, initialPosition = 0, onTimeUpdateThrottled, onEnded, className }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Identificação inteligente da origem da mídia (Google Drive, YouTube, Vimeo ou Direto)
    const parsedSource = useMemo(() => parseVideoSource(src), [src]);

    // Controle de progresso para fontes externas (Google Drive)
    const driveElapsedRef = useRef(initialPosition || 0);

    // Controle de inicialização de posição: aplicado EXATAMENTE UMA VEZ por vídeo para evitar repetição/saltos
    const initialPositionRestoredRef = useRef(false);
    const lastSrcRef = useRef(src);
    const isSeekingRef = useRef(false);
    const onTimeUpdateThrottledRef = useRef(onTimeUpdateThrottled);
    onTimeUpdateThrottledRef.current = onTimeUpdateThrottled;

    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Redefinir controle de restauração ao trocar de vídeo (nova URL)
    if (lastSrcRef.current !== src) {
      lastSrcRef.current = src;
      initialPositionRestoredRef.current = false;
      driveElapsedRef.current = initialPosition || 0;
    }

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (parsedSource.type === "direct") {
          if (!videoRef.current) return;
          const validTime = Math.max(0, Math.min(duration || 9999, seconds));
          videoRef.current.currentTime = validTime;
          setCurrentTime(validTime);
          if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
          }
        } else {
          driveElapsedRef.current = seconds;
        }
      },
      play: () => {
        if (parsedSource.type === "direct") {
          videoRef.current?.play().catch(() => {});
        }
      },
      pause: () => {
        if (parsedSource.type === "direct") {
          videoRef.current?.pause();
        }
      },
      getCurrentTime: () => {
        if (parsedSource.type === "direct") {
          return videoRef.current?.currentTime || 0;
        }
        return driveElapsedRef.current || initialPosition || 0;
      },
    }));

    // Função segura para restaurar a posição inicial apenas uma vez (vídeos diretos)
    const restoreInitialPositionOnce = useCallback(() => {
      if (initialPositionRestoredRef.current) return;
      if (!videoRef.current) return;

      if (initialPosition > 0 && Number.isFinite(initialPosition)) {
        // Apenas restaura se o vídeo estiver no início (tempo 0 ou muito próximo)
        if (videoRef.current.currentTime < 1) {
          videoRef.current.currentTime = initialPosition;
          setCurrentTime(initialPosition);
        }
      }
      initialPositionRestoredRef.current = true;
    }, [initialPosition]);

    // Tentativa de restauração quando initialPosition chega de forma assíncrona
    useEffect(() => {
      if (!initialPositionRestoredRef.current && initialPosition > 0 && videoRef.current) {
        if (videoRef.current.currentTime < 1 && videoRef.current.paused) {
          restoreInitialPositionOnce();
        }
      }
    }, [initialPosition, restoreInitialPositionOnce]);

    // Throttle de atualização de progresso contínuo para vídeo direto (salva a cada 10s sem recarregar o player)
    useEffect(() => {
      if (parsedSource.type !== "direct" || !isPlaying) return;

      const interval = setInterval(() => {
        if (
          videoRef.current &&
          !videoRef.current.paused &&
          !videoRef.current.seeking &&
          !isSeekingRef.current &&
          onTimeUpdateThrottledRef.current
        ) {
          const currentPos = Math.floor(videoRef.current.currentTime);
          if (currentPos > 0) {
            onTimeUpdateThrottledRef.current(currentPos);
          }
        }
      }, 10000);

      return () => clearInterval(interval);
    }, [isPlaying, parsedSource.type]);

    // Throttle de atualização de progresso contínuo para Google Drive (registra tempo ativo na aba a cada 10s)
    useEffect(() => {
      if (parsedSource.type !== "google-drive") return;

      const interval = setInterval(() => {
        if (document.visibilityState === "visible" && onTimeUpdateThrottledRef.current) {
          driveElapsedRef.current += 10;
          onTimeUpdateThrottledRef.current(driveElapsedRef.current);
        }
      }, 10000);

      return () => clearInterval(interval);
    }, [parsedSource.type]);

    // Alternar play/pause de forma nativa e segura
    const togglePlay = () => {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    };

    // Pular segundos (+10s / -10s) sem atraso de closures
    const handleSeek = (seconds: number) => {
      if (!videoRef.current) return;
      const targetTime = Math.max(0, Math.min(duration || 100, seconds));
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    };

    const changePlaybackRate = (rate: number) => {
      if (!videoRef.current) return;
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    };

    const toggleMute = () => {
      if (!videoRef.current) return;
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    };

    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen?.().catch(() => {});
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.().catch(() => {});
        setIsFullscreen(false);
      }
    };

    // Atalhos de teclado (espaço, setas, M, F)
    useEffect(() => {
      if (parsedSource.type !== "direct") return;

      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }

        if (e.code === "Space") {
          e.preventDefault();
          togglePlay();
        } else if (e.code === "ArrowLeft") {
          e.preventDefault();
          if (videoRef.current) {
            handleSeek(videoRef.current.currentTime - 10);
          }
        } else if (e.code === "ArrowRight") {
          e.preventDefault();
          if (videoRef.current) {
            handleSeek(videoRef.current.currentTime + 10);
          }
        } else if (e.key === "m" || e.key === "M") {
          e.preventDefault();
          toggleMute();
        } else if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          toggleFullscreen();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isMuted, duration, parsedSource.type]);

    const formatTime = (secs: number) => {
      if (!Number.isFinite(secs) || isNaN(secs) || secs < 0) return "0:00";
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    // -------------------------------------------------------------
    // RENDERIZAÇÃO: GOOGLE DRIVE (OFICIAL / PREVIEW EMBED)
    // -------------------------------------------------------------
    if (parsedSource.type === "google-drive" && parsedSource.embedUrl) {
      return (
        <div
          ref={containerRef}
          className={cn(
            "group relative overflow-hidden rounded-2xl border border-border bg-black shadow-2xl flex flex-col",
            className
          )}
        >
          <div className="relative w-full aspect-video max-h-[620px] bg-black">
            <iframe
              src={parsedSource.embedUrl}
              title="Videoaula Google Drive"
              className="w-full h-full border-0 bg-black"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          {/* Barra de Utilidades e Status do Google Drive */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-secondary/80 border-t border-border text-xs text-muted-foreground backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold text-[11px] border border-blue-500/20">
                <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
                Google Drive
              </span>
              <span className="hidden sm:inline text-[11px] text-muted-foreground">
                Reprodução oficial sem restrições de tamanho
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://drive.google.com/file/d/${parsedSource.fileId}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-background hover:bg-secondary text-foreground font-semibold text-xs border border-border transition-colors shadow-sm"
                title="Abrir no Google Drive em nova guia"
              >
                <ExternalLink className="size-3.5" />
                <span>Abrir no Drive</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------
    // RENDERIZAÇÃO: PASTA DO GOOGLE DRIVE (AVISO AMIGÁVEL)
    // -------------------------------------------------------------
    if (parsedSource.type === "folder" || parsedSource.error) {
      return (
        <div
          ref={containerRef}
          className={cn(
            "group relative overflow-hidden rounded-2xl border border-destructive/40 bg-background/95 shadow-2xl flex flex-col items-center justify-center p-8 text-center min-h-[320px] aspect-video max-h-[620px]",
            className
          )}
        >
          <div className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive mb-3">
            <AlertCircle className="size-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">Link de Pasta do Google Drive Detectado</h3>
          <p className="text-xs text-muted-foreground max-w-md mt-1.5 leading-relaxed">
            {parsedSource.error ||
              "O link fornecido aponta para uma pasta do Google Drive. Por favor, forneça o link de compartilhamento de um arquivo de vídeo individual."}
          </p>
          {parsedSource.rawUrl && (
            <a
              href={parsedSource.rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="size-3.5" /> Acessar Pasta no Google Drive
            </a>
          )}
        </div>
      );
    }

    // -------------------------------------------------------------
    // RENDERIZAÇÃO: YOUTUBE
    // -------------------------------------------------------------
    if (parsedSource.type === "youtube" && parsedSource.embedUrl) {
      return (
        <div
          ref={containerRef}
          className={cn(
            "group relative overflow-hidden rounded-2xl border border-border bg-black shadow-2xl flex flex-col",
            className
          )}
        >
          <div className="relative w-full aspect-video max-h-[620px] bg-black">
            <iframe
              src={parsedSource.embedUrl}
              title="Videoaula YouTube"
              className="w-full h-full border-0 bg-black"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/80 border-t border-border text-xs text-muted-foreground backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-semibold text-[11px] border border-red-500/20">
                YouTube
              </span>
              <span className="hidden sm:inline text-[11px] text-muted-foreground">
                Player oficial do YouTube
              </span>
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${parsedSource.fileId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-background hover:bg-secondary text-foreground font-semibold text-xs border border-border transition-colors shadow-sm"
            >
              <ExternalLink className="size-3.5" /> Abrir no YouTube
            </a>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------
    // RENDERIZAÇÃO: VIMEO
    // -------------------------------------------------------------
    if (parsedSource.type === "vimeo" && parsedSource.embedUrl) {
      return (
        <div
          ref={containerRef}
          className={cn(
            "group relative overflow-hidden rounded-2xl border border-border bg-black shadow-2xl flex flex-col",
            className
          )}
        >
          <div className="relative w-full aspect-video max-h-[620px] bg-black">
            <iframe
              src={parsedSource.embedUrl}
              title="Videoaula Vimeo"
              className="w-full h-full border-0 bg-black"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------
    // RENDERIZAÇÃO: REPRODUTOR HTML5 DIRETO (MP4 / WebM / Supabase)
    // -------------------------------------------------------------
    return (
      <div
        ref={containerRef}
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-border bg-black shadow-2xl select-none",
          className
        )}
      >
        <video
          ref={videoRef}
          src={src}
          preload="auto"
          playsInline
          className="w-full aspect-video max-h-[620px] object-contain cursor-pointer"
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onSeeked={() => setIsBuffering(false)}
          onTimeUpdate={() => {
            if (videoRef.current && !isSeekingRef.current) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              restoreInitialPositionOnce();
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            onEnded?.();
          }}
        />

        {/* Indicador de Buffering */}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-20">
            <Loader2 className="size-12 animate-spin text-primary drop-shadow-md" />
          </div>
        )}

        {/* Botão Central de Play quando pausado */}
        {!isPlaying && !isBuffering && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer backdrop-blur-[2px] transition-all z-10"
          >
            <div className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110">
              <Play className="size-8 fill-current ml-1" />
            </div>
          </div>
        )}

        {/* Barra de Controles Inferior */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-opacity z-20">
          {/* Seekbar com arraste contínuo suave */}
          <input
            type="range"
            min="0"
            max={duration > 0 ? duration : 100}
            step="0.1"
            value={currentTime}
            onMouseDown={() => {
              isSeekingRef.current = true;
            }}
            onTouchStart={() => {
              isSeekingRef.current = true;
            }}
            onChange={(e) => {
              setCurrentTime(Number(e.target.value));
            }}
            onMouseUp={(e) => {
              isSeekingRef.current = false;
              handleSeek(Number((e.target as HTMLInputElement).value));
            }}
            onTouchEnd={(e) => {
              isSeekingRef.current = false;
              handleSeek(Number((e.target as HTMLInputElement).value));
            }}
            className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary mb-3 hover:h-2 transition-all"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
                title={isPlaying ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}
              >
                {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) handleSeek(videoRef.current.currentTime - 10);
                }}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
                title="Retroceder 10s (Seta Esquerda)"
              >
                <RotateCcw className="size-4" />
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) handleSeek(videoRef.current.currentTime + 10);
                }}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
                title="Avançar 10s (Seta Direita)"
              >
                <RotateCw className="size-4" />
              </button>

              <span className="text-xs font-mono text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Seletor de Velocidade */}
              <div className="flex items-center bg-white/10 rounded-lg p-0.5 text-xs font-semibold">
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    className={cn(
                      "px-2 py-1 rounded transition-colors",
                      playbackRate === rate ? "bg-primary text-white font-bold" : "text-white/80 hover:bg-white/20"
                    )}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {/* Mute */}
              <button
                onClick={toggleMute}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
                title={isMuted ? "Ativar som (M)" : "Silenciar (M)"}
              >
                {isMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
                title={isFullscreen ? "Sair da Tela Cheia (F)" : "Tela Cheia (F)"}
              >
                {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
