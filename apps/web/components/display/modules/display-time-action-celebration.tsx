"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Coffee, LogIn, LogOut, Pause } from "lucide-react";
import {
  DISPLAY_TIME_CELEBRATION_EXIT_MS,
  DISPLAY_TIME_CELEBRATION_EXIT_REDUCED_MS,
  DISPLAY_TIME_CELEBRATION_HOLD_MS,
  DISPLAY_TIME_CELEBRATION_HOLD_REDUCED_MS,
  MOTION_EASE_OUT,
} from "@/lib/ui/motion-presets";
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

type DisplayTimeActionCelebrationProps = {
  action: DisplayTimeCelebrationAction | null;
  onDone?: () => void;
};

export function DisplayTimeActionCelebration({
  action,
  onDone,
}: DisplayTimeActionCelebrationProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const holdMs = reduceMotion
    ? DISPLAY_TIME_CELEBRATION_HOLD_REDUCED_MS
    : DISPLAY_TIME_CELEBRATION_HOLD_MS;
  const exitMs = reduceMotion
    ? DISPLAY_TIME_CELEBRATION_EXIT_REDUCED_MS
    : DISPLAY_TIME_CELEBRATION_EXIT_MS;

  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [renderAction, setRenderAction] =
    useState<DisplayTimeCelebrationAction | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const clearHoldTimer = () => {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    clearHoldTimer();

    if (action) {
      setRenderAction(action);
      setVisible(true);
      holdTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        holdTimerRef.current = null;
      }, holdMs);
      return clearHoldTimer;
    }

    setVisible(false);
    return clearHoldTimer;
  }, [action, holdMs]);

  const meta = renderAction ? ACTION_META[renderAction] : null;
  const accent = meta?.color ?? "var(--accent)";
  const Icon = meta?.Icon ?? LogIn;

  const exitEase = MOTION_EASE_OUT;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      mode="wait"
      onExitComplete={() => {
        setRenderAction(null);
        onDoneRef.current?.();
      }}
    >
      {visible && renderAction && meta ? (
        <motion.div
          key={renderAction}
          className="pointer-events-none fixed inset-0 z-[35] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: reduceMotion ? 1 : 0.98,
          }}
          transition={{
            opacity: {
              duration: reduceMotion ? 0.08 : 0.32,
              ease: exitEase,
            },
            scale: {
              duration: exitMs / 1000,
              ease: exitEase,
            },
          }}
          aria-live="polite"
          aria-label={meta.label}
        >
          <motion.div
            className="absolute inset-0 bg-background/45 backdrop-blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0.08 : 0.32,
              ease: exitEase,
            }}
          />

          <motion.div
            className="pointer-events-none absolute size-72 rounded-full opacity-50 blur-3xl"
            style={{
              background: `radial-gradient(circle, color-mix(in srgb, ${accent} 50%, transparent) 0%, transparent 68%)`,
            }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1.35, opacity: 0.55 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0.12 : 0.7,
              ease: exitEase,
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
                    ease: exitEase,
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
                      ease: exitEase,
                    }}
                  />
                );
              })
            : null}

          <motion.div
            className="relative flex flex-col items-center gap-3 px-6 text-center"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 12, scale: reduceMotion ? 1 : 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -6, scale: reduceMotion ? 1 : 0.96 }}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : {
                    type: "spring",
                    stiffness: 360,
                    damping: 28,
                    mass: 0.9,
                  }
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
                transition={{ duration: reduceMotion ? 0.1 : 0.38, delay: 0.04 }}
              />
              <motion.div
                className={cn(
                  "relative flex size-24 items-center justify-center rounded-full",
                  "bg-card/95 ring-1 ring-border/50 backdrop-blur-md",
                )}
                initial={{ scale: reduceMotion ? 1 : 0.55, rotate: reduceMotion ? 0 : -6 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0.1 }
                    : { type: "spring", stiffness: 420, damping: 24, delay: 0.02 }
                }
              >
                <motion.div
                  initial={{ scale: reduceMotion ? 1 : 0.6, opacity: reduceMotion ? 1 : 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={
                    reduceMotion
                      ? { duration: 0.1 }
                      : { type: "spring", stiffness: 480, damping: 26, delay: 0.08 }
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
                  duration: reduceMotion ? 0.1 : 0.36,
                  delay: reduceMotion ? 0 : 0.14,
                  ease: exitEase,
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
                    duration: reduceMotion ? 0.1 : 0.36,
                    delay: reduceMotion ? 0 : 0.22,
                    ease: exitEase,
                  }}
                >
                  {meta.sublabel}
                </motion.p>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
