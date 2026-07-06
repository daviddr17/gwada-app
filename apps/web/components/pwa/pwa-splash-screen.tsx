"use client";

import { cn } from "@/lib/utils";
import {
  PWA_SPLASH_LOGO_PX,
  PWA_SPLASH_EXIT_EASE,
  PWA_SPLASH_EXIT_MS,
} from "@/lib/pwa/pwa-splash-timing";

export type PwaSplashPhase = "hold" | "spin" | "exit" | "done";

type PwaSplashScreenProps = {
  iconSrc: string;
  phase: PwaSplashPhase;
  className?: string;
};

/** Vollbild-Splash — gleiche Logo-Größe in allen Phasen (kein Sprung beim Drehen). */
export function PwaSplashScreen({ iconSrc, phase, className }: PwaSplashScreenProps) {
  if (phase === "done") return null;

  return (
    <div
      className={cn(
        "dashboard-pwa-splash fixed inset-0 z-[99999] flex items-center justify-center",
        phase === "exit" && "dashboard-pwa-splash--exit",
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
          "dashboard-pwa-splash__logo-wrap flex items-center justify-center",
          phase === "spin" && "dashboard-pwa-splash--spin",
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
          className="dashboard-pwa-splash__logo size-full object-contain select-none"
        />
      </div>
    </div>
  );
}
