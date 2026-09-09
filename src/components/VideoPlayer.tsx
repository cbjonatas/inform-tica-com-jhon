import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
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

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = Math.max(0, Math.min(duration || 9999, seconds));
        setCurrentTime(videoRef.current.currentTime);
        if (videoRef.current.paused) {
          videoRef.current.play();
          setIsPlaying(true);
        }
      },
      play: () => {
        videoRef.current?.play();
        setIsPlaying(true);
      },
      pause: () => {
        videoRef.current?.pause();
        setIsPlaying(false);
      },
      getCurrentTime: () => videoRef.current?.currentTime || 0,
    }));

    // Retomar posição salva inicial
    useEffect(() => {
      if (videoRef.current && initialPosition > 0) {
        videoRef.current.currentTime = initialPosition;
      }
    }, [initialPosition]);

    // Throttle de atualização para persistência no banco
    useEffect(() => {
      if (!isPlaying) return;
      const interval = setInterval(() => {
        if (videoRef.current && onTimeUpdateThrottled) {
          onTimeUpdateThrottled(videoRef.current.currentTime);
        }
      }, 8000);
      return () => clearInterval(interval);
    }, [isPlaying, onTimeUpdateThrottled]);

    // Atalhos de teclado
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Ignorar se o usuário estiver digitando em input ou textarea
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

        if (e.code === "Space") {
          e.preventDefault();
          togglePlay();
        } else if (e.code === "ArrowLeft") {
          e.preventDefault();
          handleSeek(currentTime - 10);
        } else if (e.code === "ArrowRight") {
          e.preventDefault();
          handleSeek(currentTime + 10);
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
    }, [currentTime, duration, isMuted]);

    const togglePlay = () => {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };

    const handleSeek = (seconds: number) => {
      if (!videoRef.current) return;
      videoRef.current.currentTime = Math.max(0, Math.min(duration || 100, seconds));
      setCurrentTime(videoRef.current.currentTime);
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
        containerRef.current.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    };

    const formatTime = (secs: number) => {
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
          className="w-full aspect-video max-h-[620px] object-contain cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              if (initialPosition > 0) videoRef.current.currentTime = initialPosition;
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            onEnded?.();
          }}
          playsInline
        />

        {/* Botão Central de Play/Pause */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer backdrop-blur-[2px] transition-all"
          >
            <div className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110">
              <Play className="size-8 fill-current ml-1" />
            </div>
          </div>
        )}

        {/* Barra de Controles Inferior */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-opacity">
          {/* Seekbar */}
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary mb-3 hover:h-2 transition-all"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
              >
                {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
              </button>

              <button
                onClick={() => handleSeek(currentTime - 10)}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
                title="Retroceder 10s (Seta Esquerda)"
              >
                <RotateCcw className="size-4" />
              </button>

              <button
                onClick={() => handleSeek(currentTime + 10)}
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
                title="Silenciar (M)"
              >
                {isMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/20 transition-colors"
                title="Tela Cheia (F)"
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
