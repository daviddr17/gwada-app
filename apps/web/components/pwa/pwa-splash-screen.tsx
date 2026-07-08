"use client";

import { cn } from "@/lib/utils";
import type { PwaSplashAppId } from "@/lib/pwa/pwa-splash-state";
import {
  PWA_SPLASH_LOGO_PX,
  PWA_SPLASH_EXIT_EASE,
  PWA_SPLASH_EXIT_MS,
} from "@/lib/pwa/pwa-splash-timing";

export type PwaSplashPhase = "hold" | "spin" | "exit" | "done";

type PwaSplashScreenProps = {
  app: PwaSplashAppId;
  iconSrc: string;
  phase: PwaSplashPhase;
  /** App bereit — Klicks durchlassen, Splash blendet nur noch visuell aus. */
  allowInteraction?: boolean;
  className?: string;
};

/** Vollbild-Splash — gleiche Logo-Größe in allen Phasen (kein Sprung beim Drehen). */
export function PwaSplashScreen({
  app,
  iconSrc,
  phase,
  allowInteraction = false,
  className,
}: PwaSplashScreenProps) {
  if (phase === "done") return null;

  return (
    <div
      data-pwa-splash-app={app}
      className={cn(
        "pwa-splash fixed inset-0 z-[99999] flex items-center justify-center",
        phase === "exit" && "pwa-splash--exit",
        allowInteraction && "pointer-events-none",
        className,
      )}
      style={
        phase === "exit"
          ? {
              transition: `opacity ${PWA_SPLASH_EXIT_MS}ms ${PWA_SPLASH_EXIT_EASE}`,
            }
          : undefined
      }
      aria-hidden="true"
    >
      <div
        className={cn(
          "pwa-splash__logo-wrap flex items-center justify-center",
          phase === "spin" && "pwa-splash--spin",
        )}
        style={{ width: PWA_SPLASH_LOGO_PX, height: PWA_SPLASH_LOGO_PX }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconSrc}
          alt=""
          width={PWA_SPLASH_LOGO_PX}
          height={PWA_SPLASH_LOGO_PX}
          decoding="sync"
          fetchPriority="high"
          draggable={false}
          className="pwa-splash__logo size-full object-contain select-none"
        />
      </div>
    </div>
  );
}
