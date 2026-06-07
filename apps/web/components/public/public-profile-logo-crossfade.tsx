"use client";

import { m, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { RestaurantLogoMark } from "@/components/ui/restaurant-logo-mark";
import { cn } from "@/lib/utils";

const GWADA_HOLD_MS = 520;
const CROSSFADE_MS = 680;
const FADE_EASE = [0.22, 1, 0.36, 1] as const;

export type PublicProfileLogoIntro = {
  gwadaIconSrc: string;
  active: boolean;
  onComplete: () => void;
};

function restaurantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0]!.slice(0, 1).toLocaleUpperCase("de-DE") +
      parts[1]!.slice(0, 1).toLocaleUpperCase("de-DE")
    );
  }
  return name.trim().slice(0, 2).toLocaleUpperCase("de-DE") || "?";
}

/** Gwada-Favicon ausblenden, Restaurant-Logo einblenden — eine Instanz, bleibt im Hero. */
export function PublicProfileLogoCrossfade({
  gwadaIconSrc,
  restaurantAvatarUrl,
  restaurantName,
  active,
  onComplete,
  className,
}: {
  gwadaIconSrc: string | null;
  restaurantAvatarUrl: string | null;
  restaurantName: string;
  active: boolean;
  onComplete?: () => void;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const initials = restaurantInitials(restaurantName);
  const completedRef = useRef(false);
  const [fadeGwada, setFadeGwada] = useState(false);
  const [gwadaDone, setGwadaDone] = useState(
    () => !gwadaIconSrc || Boolean(reduceMotion),
  );

  const runIntro =
    Boolean(gwadaIconSrc) &&
    active &&
    !reduceMotion &&
    !completedRef.current &&
    !gwadaDone;

  useEffect(() => {
    if (restaurantAvatarUrl) {
      const img = new Image();
      img.src = restaurantAvatarUrl;
    }
  }, [restaurantAvatarUrl]);

  useEffect(() => {
    if (!runIntro) {
      return;
    }

    const fadeTimer = window.setTimeout(
      () => setFadeGwada(true),
      GWADA_HOLD_MS,
    );
    const doneTimer = window.setTimeout(
      () => {
        completedRef.current = true;
        setGwadaDone(true);
        onComplete?.();
      },
      GWADA_HOLD_MS + CROSSFADE_MS,
    );

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [runIntro, onComplete]);

  useEffect(() => {
    if (!gwadaIconSrc || reduceMotion) {
      completedRef.current = true;
      setGwadaDone(true);
      if (active) {
        onComplete?.();
      }
    }
  }, [active, gwadaIconSrc, onComplete, reduceMotion]);

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <m.div
        initial={runIntro ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={
          runIntro
            ? {
                delay: GWADA_HOLD_MS / 1000,
                duration: CROSSFADE_MS / 1000,
                ease: FADE_EASE,
              }
            : { duration: 0 }
        }
      >
        <RestaurantLogoMark
          src={restaurantAvatarUrl}
          initials={initials}
          alt=""
          variant="profile"
        />
      </m.div>

      {!gwadaDone && gwadaIconSrc && !reduceMotion ? (
        <m.div
          className={cn(
            "absolute inset-0 z-[1] flex items-center justify-center overflow-hidden rounded-full",
            "bg-card shadow-lg ring-[4px] ring-white/90 dark:bg-card dark:ring-background",
          )}
          initial={{ opacity: 1 }}
          animate={{ opacity: fadeGwada ? 0 : 1 }}
          transition={{ duration: CROSSFADE_MS / 1000, ease: FADE_EASE }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gwadaIconSrc}
            alt=""
            width={96}
            height={96}
            decoding="async"
            className="size-[58%] object-contain"
          />
        </m.div>
      ) : null}
    </div>
  );
}
