"use client";

import { cn } from "@/lib/utils";

type SpeechLiveCaptionProps = {
  listening: boolean;
  interim: string;
  className?: string;
  /** Portal-Variante: unten zentriert (Display / Tablet). */
  floating?: boolean;
};

export function SpeechLiveCaption({
  listening,
  interim,
  className,
  floating = false,
}: SpeechLiveCaptionProps) {
  if (!listening) return null;

  const label = interim.trim() || "Hört zu …";

  if (floating) {
    return (
      <div
        className={cn(
          "pointer-events-none fixed inset-x-4 z-[120] flex justify-center bottom-[calc(var(--app-mobile-bottom-nav-bar)+max(1.25rem,env(safe-area-inset-bottom)))]",
          className,
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        <div
          className={cn(
            "max-w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-border/50 bg-card/95 px-4 py-3 text-center text-base text-foreground shadow-card backdrop-blur-md",
            "animate-pulse",
          )}
        >
          {label}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none max-w-[min(18rem,calc(100vw-5rem))] rounded-2xl border border-border/50 bg-card/95 px-3 py-2 text-sm text-foreground shadow-card backdrop-blur-md",
        "animate-pulse",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      {label}
    </div>
  );
}
