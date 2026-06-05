"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const SPLASH_HOLD_MS = 620;
const SPLASH_EXIT_MS = 720;

type SplashPhase = "playing" | "exiting" | "done";

/**
 * LCP-neutral: Profil-Inhalt bleibt sichtbar; nur das Icon blendet darüber ein/aus.
 */
export function PublicProfileSplashIntro({
  iconSrc,
  children,
}: {
  iconSrc: string | null;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<SplashPhase>("playing");
  const [enterActive, setEnterActive] = useState(false);
  const showIcon = phase !== "done" && Boolean(iconSrc);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion || !iconSrc) {
      setPhase("done");
      return;
    }

    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setEnterActive(true);
      });
    });

    const exitTimer = window.setTimeout(() => {
      setPhase("exiting");
    }, SPLASH_HOLD_MS);

    const doneTimer = window.setTimeout(() => {
      setPhase("done");
    }, SPLASH_HOLD_MS + SPLASH_EXIT_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [iconSrc]);

  useEffect(() => {
    if (phase === "done") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  return (
    <div className="relative min-h-dvh">
      {children}

      {showIcon ? (
        <div
          className={cn(
            "public-profile-splash-overlay",
            phase === "exiting" && "public-profile-splash-overlay-exit",
          )}
          aria-hidden={phase === "exiting"}
          aria-busy={phase === "playing"}
          aria-label="gwada"
        >
          <div
            className={cn(
              "public-profile-splash-icon-wrap",
              !enterActive && "opacity-0",
              enterActive && phase === "playing" && "public-profile-splash-icon-enter",
              phase === "exiting" && "public-profile-splash-icon-exit",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={iconSrc!}
              alt=""
              width={96}
              height={96}
              decoding="async"
              fetchPriority="low"
              className="public-profile-splash-logo"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
