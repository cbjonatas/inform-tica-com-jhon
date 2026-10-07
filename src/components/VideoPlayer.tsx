import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import {
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

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ src, initialPosition = 0, onTimeUpdateThrottled, onEnded, className }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Controle de inicialização de posição: aplicado EXATAMENTE UMA VEZ por vídeo
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
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Redefinir controle de restauração ao trocar de vídeo (nova URL)
    if (lastSrcRef.current !== src) {
      lastSrcRef.current = src;
      initialPositionRestoredRef.current = false;
    }

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (!videoRef.current) return;
        const validTime = Math.max(0, Math.min(duration || 9999, seconds));
        videoRef.current.currentTime = validTime;
        setCurrentTime(validTime);
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
      },
      play: () => {
        videoRef.current?.play().catch(() => {});
      },
      pause: () => {
        videoRef.current?.pause();
      },
      getCurrentTime: () => videoRef.current?.currentTime || 0,
    }));

    // Função segura para restaurar a posição inicial apenas uma vez
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

    // Throttle de atualização de progresso para persistência no banco (sem loop e sem recarregar o player)
    useEffect(() => {
      if (!isPlaying) return;

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
      }, 10000); // Salva a cada 10 segundos continuamente

      return () => clearInterval(interval);
    }, [isPlaying]);

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
    }, [isMuted, duration]);

    const formatTime = (secs: number) => {
      if (!Number.isFinite(secs) || isNaN(secs) || secs < 0) return "0:00";
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

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
