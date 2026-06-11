"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function ContactMessageVoicePlayer({
  url,
  outbound,
  durationSeconds,
  className,
}: {
  url: string;
  outbound?: boolean;
  durationSeconds?: number | null;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    if (durationSeconds != null && durationSeconds > 0) {
      setDuration(durationSeconds);
    }
  }, [url, durationSeconds]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [playing]);

  return (
    <div
      className={cn(
        "flex min-w-[12rem] max-w-full items-center gap-2 rounded-xl px-1 py-1",
        className,
      )}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => {
          const d = event.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(event) => {
          const el = event.currentTarget;
          if (!Number.isFinite(el.duration) || el.duration <= 0) {
            setProgress(0);
            return;
          }
          setProgress(el.currentTime / el.duration);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      <button
        type="button"
        onClick={() => void togglePlay()}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
          outbound
            ? "bg-accent-foreground/15 text-accent-foreground hover:bg-accent-foreground/25"
            : "bg-foreground/10 text-foreground hover:bg-foreground/15",
        )}
        aria-label={playing ? "Pause" : "Abspielen"}
      >
        {playing ? (
          <Pause className="size-4" aria-hidden />
        ) : (
          <Play className="ms-0.5 size-4" aria-hidden />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "relative h-1.5 overflow-hidden rounded-full",
            outbound ? "bg-accent-foreground/20" : "bg-foreground/10",
          )}
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width]",
              outbound ? "bg-accent-foreground" : "bg-accent",
            )}
            style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] tabular-nums opacity-80">
          <span className="inline-flex items-center gap-1">
            <Mic className="size-3" aria-hidden />
            Sprachnachricht
          </span>
          <span>{formatDuration(duration || 0)}</span>
        </div>
      </div>
    </div>
  );
}
