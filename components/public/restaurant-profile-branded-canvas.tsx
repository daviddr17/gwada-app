"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  brandProfileBackdropColors,
  brandedProfileBackdropStyle,
  profileHeroBlobBackground,
} from "@/lib/public-profile/profile-branded-backdrop";
import { cn } from "@/lib/utils";

export { brandedProfileBackdropStyle } from "@/lib/public-profile/profile-branded-backdrop";

/** Landing-ähnliches Zwei-Farben-Mesh — Restaurant-Akzent + abgeleitete Harmony-Farbe. */
export function RestaurantProfileBrandedCanvas({
  accentHex,
  sheetOpen = false,
}: {
  accentHex: string;
  sheetOpen?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [motionReady, setMotionReady] = useState(false);
  const { accent, harmony } = useMemo(
    () => brandProfileBackdropColors(accentHex),
    [accentHex],
  );

  useEffect(() => {
    if (reduceMotion) return;
    const enable = () => setMotionReady(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(enable, { timeout: 1800 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(enable, 900);
    return () => globalThis.clearTimeout(id);
  }, [reduceMotion]);

  const showBlobs = motionReady && !reduceMotion;

  const blob = (color: string, position: CSSProperties, strongOpacity: number) => ({
    ...position,
    background: profileHeroBlobBackground(color, strongOpacity),
  });

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden bg-background",
        sheetOpen && "[&_.gwada-hero-blob]:![animation-play-state:paused]",
      )}
      style={brandedProfileBackdropStyle(accentHex)}
    >
      {showBlobs ? (
        <>
          <div
            className="gwada-hero-blob motion-safe:animate-[gwada-hero-blob-a_22s_ease-in-out_infinite]"
            style={blob(
              accent,
              {
                width: "min(92vw, 620px)",
                height: "min(92vw, 620px)",
                left: "-14%",
                top: "-12%",
              },
              94,
            )}
          />
          <div
            className="gwada-hero-blob motion-safe:animate-[gwada-hero-blob-b_26s_ease-in-out_infinite]"
            style={blob(
              harmony,
              {
                width: "min(88vw, 540px)",
                height: "min(88vw, 540px)",
                right: "-18%",
                top: "4%",
              },
              46,
            )}
          />
          <div
            className="gwada-hero-blob motion-safe:animate-[gwada-hero-blob-c_20s_ease-in-out_infinite]"
            style={blob(
              accent,
              {
                width: "min(100vw, 680px)",
                height: "min(100vw, 680px)",
                left: "18%",
                bottom: "-28%",
              },
              68,
            )}
          />
          <div
            className="gwada-hero-blob motion-safe:animate-[gwada-hero-blob-d_24s_ease-in-out_infinite] opacity-95"
            style={blob(
              accent,
              {
                width: "min(75vw, 480px)",
                height: "min(75vw, 480px)",
                left: "38%",
                top: "22%",
              },
              62,
            )}
          />
          <div
            className="pointer-events-none absolute inset-0 mix-blend-screen opacity-35 dark:opacity-30"
            style={{
              background:
                "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.16) 45%, transparent 70%)",
            }}
          />
        </>
      ) : null}
    </div>
  );
}
