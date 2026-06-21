"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Coffee, LogIn, LogOut, Pause } from "lucide-react";
import { MOTION_EASE_OUT } from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";

export type DisplayTimeCelebrationAction =
  | "clock_in"
  | "start_break"
  | "end_break"
  | "clock_out";

type ActionMeta = {
  label: string;
  sublabel?: string;
  color: string;
  Icon: typeof LogIn;
};

const ACTION_META: Record<DisplayTimeCelebrationAction, ActionMeta> = {
  clock_in: {
    label: "Schicht gestartet",
    sublabel: "Guten Start!",
    color: "#22c55e",
    Icon: LogIn,
  },
  start_break: {
    label: "Pause läuft",
    sublabel: "Erhol dich gut",
    color: "#3b82f6",
    Icon: Pause,
  },
  end_break: {
    label: "Willkommen zurück",
    sublabel: "Weiter geht's",
    color: "#22c55e",
    Icon: Coffee,
  },
  clock_out: {
    label: "Schicht beendet",
    sublabel: "Bis bald!",
    color: "#64748b",
    Icon: LogOut,
  },
};

const RING_DELAYS = [0, 0.12, 0.24] as const;
const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

export function displayTimeActionCelebrationMs(reduceMotion: boolean): number {
  return reduceMotion ? 140 : 780;
}

type DisplayTimeActionCelebrationProps = {
  action: DisplayTimeCelebrationAction | null;
  onDone?: () => void;
};

export function DisplayTimeActionCelebration({
  action,
  onDone,
}: DisplayTimeActionCelebrationProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const meta = action ? ACTION_META[action] : null;
  const accent = meta?.color ?? "var(--accent)";
  const Icon = meta?.Icon ?? LogIn;

  useEffect(() => {
    if (!action) return;
    const timer = window.setTimeout(() => {
      onDone?.();
    }, displayTimeActionCelebrationMs(reduceMotion));
    return () => window.clearTimeout(timer);
  }, [action, onDone, reduceMotion]);

  return (
    <AnimatePresence>
      {action && meta ? (
        <motion.div
          key={action}
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-3xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.08 : 0.28, ease: MOTION_EASE_OUT }}
          aria-live="polite"
          aria-label={meta.label}
        >
          <motion.div
            className="absolute inset-0 bg-background/55 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.08 : 0.32 }}
          />

          <motion.div
            className="pointer-events-none absolute size-72 rounded-full opacity-50 blur-3xl"
            style={{
              background: `radial-gradient(circle, color-mix(in srgb, ${accent} 50%, transparent) 0%, transparent 68%)`,
            }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1.35, opacity: 0.55 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0.12 : 0.85,
              ease: MOTION_EASE_OUT,
            }}
          />

          {!reduceMotion
            ? RING_DELAYS.map((delay, index) => (
                <motion.span
                  key={index}
                  className="pointer-events-none absolute size-28 rounded-full border"
                  style={{
                    borderColor: `color-mix(in srgb, ${accent} 38%, transparent)`,
                  }}
                  initial={{ scale: 0.5, opacity: 0.6 }}
                  animate={{ scale: 2.4 + index * 0.2, opacity: 0 }}
                  transition={{
                    duration: 0.95,
                    delay,
                    ease: MOTION_EASE_OUT,
                  }}
                />
              ))
            : null}

          {!reduceMotion
            ? PARTICLE_ANGLES.map((angle, index) => {
                const rad = (angle * Math.PI) / 180;
                const dist = 72 + (index % 3) * 14;
                return (
                  <motion.span
                    key={angle}
                    className="pointer-events-none absolute size-1.5 rounded-full"
                    style={{ backgroundColor: accent }}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                    animate={{
                      x: Math.cos(rad) * dist,
                      y: Math.sin(rad) * dist,
                      opacity: [0, 0.9, 0],
                      scale: [0, 1.2, 0.4],
                    }}
                    transition={{
                      duration: 0.72,
                      delay: 0.08 + index * 0.025,
                      ease: MOTION_EASE_OUT,
                    }}
                  />
                );
              })
            : null}

          <motion.div
            className="relative flex flex-col items-center gap-3 px-6 text-center"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 14, scale: reduceMotion ? 1 : 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8, scale: reduceMotion ? 1 : 0.96 }}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { type: "spring", stiffness: 380, damping: 26, mass: 0.85 }
            }
          >
            <div className="relative">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 22%, transparent), 0 20px 48px color-mix(in srgb, ${accent} 20%, transparent)`,
                }}
                initial={{ scale: 0.75, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.4, delay: 0.04 }}
              />
              <motion.div
                className={cn(
                  "relative flex size-24 items-center justify-center rounded-full",
                  "bg-card/95 ring-1 ring-border/50 backdrop-blur-md",
                )}
                initial={{ scale: reduceMotion ? 1 : 0.55, rotate: reduceMotion ? 0 : -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0.1 }
                    : { type: "spring", stiffness: 440, damping: 22, delay: 0.02 }
                }
              >
                <motion.div
                  initial={{ scale: reduceMotion ? 1 : 0.6, opacity: reduceMotion ? 1 : 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={
                    reduceMotion
                      ? { duration: 0.1 }
                      : { type: "spring", stiffness: 500, damping: 24, delay: 0.1 }
                  }
                >
                  <Icon
                    className="size-11"
                    style={{ color: accent }}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                </motion.div>
              </motion.div>
            </div>

            <div className="space-y-0.5">
              <motion.p
                className="text-2xl font-semibold tracking-tight text-foreground"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduceMotion ? 0.1 : 0.38,
                  delay: reduceMotion ? 0 : 0.18,
                  ease: MOTION_EASE_OUT,
                }}
              >
                {meta.label}
              </motion.p>
              {meta.sublabel ? (
                <motion.p
                  className="text-sm text-muted-foreground"
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0.1 : 0.38,
                    delay: reduceMotion ? 0 : 0.26,
                    ease: MOTION_EASE_OUT,
                  }}
                >
                  {meta.sublabel}
                </motion.p>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
