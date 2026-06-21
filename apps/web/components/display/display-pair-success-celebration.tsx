"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Monitor } from "lucide-react";
import { MOTION_EASE_OUT } from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";

type DisplayPairSuccessCelebrationProps = {
  open: boolean;
  restaurantName?: string | null;
  accentHex?: string | null;
  className?: string;
};

const RING_DELAYS = [0, 0.18, 0.36] as const;

export function DisplayPairSuccessCelebration({
  open,
  restaurantName,
  accentHex,
  className,
}: DisplayPairSuccessCelebrationProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const accent = accentHex?.trim() || "var(--accent)";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center overflow-hidden px-6",
            className,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.08 : 0.32, ease: MOTION_EASE_OUT }}
          aria-live="polite"
          aria-label="Display erfolgreich gekoppelt"
        >
          <motion.div
            className="absolute inset-0 bg-background/75 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0.08 : 0.4 }}
          />

          <motion.div
            className="pointer-events-none absolute size-[min(90vw,28rem)] rounded-full opacity-40 blur-3xl"
            style={{
              background: `radial-gradient(circle, color-mix(in srgb, ${accent} 55%, transparent) 0%, transparent 70%)`,
            }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.15, opacity: 0.45 }}
            transition={{
              duration: reduceMotion ? 0.15 : 1.1,
              ease: MOTION_EASE_OUT,
            }}
          />

          {!reduceMotion
            ? RING_DELAYS.map((delay, index) => (
                <motion.span
                  key={index}
                  className="pointer-events-none absolute size-36 rounded-full border"
                  style={{ borderColor: `color-mix(in srgb, ${accent} 35%, transparent)` }}
                  initial={{ scale: 0.55, opacity: 0.55 }}
                  animate={{ scale: 2.2 + index * 0.25, opacity: 0 }}
                  transition={{
                    duration: 1.6,
                    delay,
                    ease: MOTION_EASE_OUT,
                  }}
                />
              ))
            : null}

          <motion.div
            className="relative flex flex-col items-center gap-5 text-center"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { type: "spring", stiffness: 340, damping: 28, mass: 0.85 }
            }
          >
            <div className="relative">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 25%, transparent), 0 24px 60px color-mix(in srgb, ${accent} 18%, transparent)`,
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.45, delay: 0.08 }}
              />
              <motion.div
                className={cn(
                  "relative flex size-28 items-center justify-center rounded-full",
                  "bg-card/90 ring-1 ring-border/50 backdrop-blur-md",
                )}
                initial={{ scale: reduceMotion ? 1 : 0.6 }}
                animate={{ scale: 1 }}
                transition={
                  reduceMotion
                    ? { duration: 0.1 }
                    : { type: "spring", stiffness: 420, damping: 22, delay: 0.05 }
                }
              >
                <Monitor
                  className="absolute size-10 text-muted-foreground/20"
                  aria-hidden
                />
                <motion.svg
                  viewBox="0 0 52 52"
                  className="relative size-14"
                  aria-hidden
                  initial={{ scale: reduceMotion ? 1 : 0.85, opacity: reduceMotion ? 1 : 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={
                    reduceMotion
                      ? { duration: 0.1 }
                      : { type: "spring", stiffness: 420, damping: 24, delay: 0.12 }
                  }
                >
                  <motion.circle
                    cx="26"
                    cy="26"
                    r="22"
                    fill={`color-mix(in srgb, ${accent} 14%, transparent)`}
                    initial={{ scale: reduceMotion ? 1 : 0, opacity: reduceMotion ? 1 : 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      duration: reduceMotion ? 0.1 : 0.35,
                      delay: reduceMotion ? 0 : 0.18,
                      ease: MOTION_EASE_OUT,
                    }}
                    style={{ transformOrigin: "26px 26px" }}
                  />
                  <motion.circle
                    cx="26"
                    cy="26"
                    r="22"
                    fill="none"
                    stroke={accent}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    initial={{ pathLength: reduceMotion ? 1 : 0, opacity: reduceMotion ? 1 : 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{
                      pathLength: {
                        duration: reduceMotion ? 0 : 0.55,
                        delay: reduceMotion ? 0 : 0.2,
                        ease: MOTION_EASE_OUT,
                      },
                      opacity: { duration: 0.12, delay: reduceMotion ? 0 : 0.16 },
                    }}
                  />
                  <motion.path
                    d="M15 26.5 22.5 34 37 18.5"
                    fill="none"
                    stroke={accent}
                    strokeWidth={3.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: reduceMotion ? 1 : 0, opacity: reduceMotion ? 1 : 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{
                      pathLength: {
                        duration: reduceMotion ? 0 : 0.42,
                        delay: reduceMotion ? 0 : 0.62,
                        ease: MOTION_EASE_OUT,
                      },
                      opacity: { duration: 0.12, delay: reduceMotion ? 0 : 0.58 },
                    }}
                    style={{
                      filter: `drop-shadow(0 0 6px color-mix(in srgb, ${accent} 45%, transparent))`,
                    }}
                  />
                </motion.svg>
              </motion.div>
            </div>

            <div className="space-y-1.5">
              <motion.p
                className="text-3xl font-semibold tracking-tight text-foreground"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduceMotion ? 0.1 : 0.45,
                  delay: reduceMotion ? 0 : 0.42,
                  ease: MOTION_EASE_OUT,
                }}
              >
                Verbunden
              </motion.p>
              {restaurantName ? (
                <motion.p
                  className="max-w-xs text-base text-muted-foreground"
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0.1 : 0.45,
                    delay: reduceMotion ? 0 : 0.52,
                    ease: MOTION_EASE_OUT,
                  }}
                >
                  {restaurantName}
                </motion.p>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Wartezeit vor Redirect nach Erfolgs-Overlay. */
export function displayPairSuccessNavigateDelayMs(reduceMotion: boolean): number {
  return reduceMotion ? 450 : 2400;
}
