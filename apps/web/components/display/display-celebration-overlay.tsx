"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Coffee, Hand, LogIn, LogOut, Pause } from "lucide-react";
import {
  DISPLAY_CELEBRATION_EXIT_MS,
  DISPLAY_CELEBRATION_EXIT_REDUCED_MS,
  DISPLAY_CELEBRATION_HOLD_MS,
  DISPLAY_CELEBRATION_HOLD_REDUCED_MS,
  MOTION_EASE_IN_OUT,
  MOTION_EASE_OUT,
} from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";

export type DisplayTimeCelebrationAction =
  | "clock_in"
  | "start_break"
  | "end_break"
  | "clock_out";

export type DisplayCelebrationVariant =
  | DisplayTimeCelebrationAction
  | "pin_welcome"
  | "sign_out";

type CelebrationMeta = {
  label: string;
  sublabel?: string;
  color: string;
  Icon: typeof LogIn;
};

const CELEBRATION_META: Record<DisplayCelebrationVariant, CelebrationMeta> = {
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
    sublabel: "Auf Wiedersehen",
    color: "#64748b",
    Icon: LogOut,
  },
  pin_welcome: {
    label: "Hallo",
    sublabel: "Schön, dass du da bist",
    color: "var(--accent)",
    Icon: Hand,
  },
  sign_out: {
    label: "Auf Wiedersehen",
    sublabel: "Bis zum nächsten Mal",
    color: "#64748b",
    Icon: LogOut,
  },
};

const RING_DELAYS = [0, 0.12, 0.24] as const;
const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

type DisplayCelebrationOverlayProps = {
  variant: DisplayCelebrationVariant | null;
  /** Ersetzt Standard-Sublabel, z. B. Vorname bei PIN-Login. */
  sublabel?: string;
  /** Wenn die Hold-Phase endet — Zielseite parallel zum Overlay-Ausblenden wechseln. */
  onExitStart?: () => void;
  onDone?: () => void;
};

export function DisplayCelebrationOverlay({
  variant,
  sublabel,
  onExitStart,
  onDone,
}: DisplayCelebrationOverlayProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const holdMs = reduceMotion
    ? DISPLAY_CELEBRATION_HOLD_REDUCED_MS
    : DISPLAY_CELEBRATION_HOLD_MS;
  const exitMs = reduceMotion
    ? DISPLAY_CELEBRATION_EXIT_REDUCED_MS
    : DISPLAY_CELEBRATION_EXIT_MS;
  const exitSec = exitMs / 1000;

  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [renderVariant, setRenderVariant] =
    useState<DisplayCelebrationVariant | null>(null);
  const [renderSublabel, setRenderSublabel] = useState<string | undefined>();
  const holdTimerRef = useRef<number | null>(null);
  const onDoneRef = useRef(onDone);
  const onExitStartRef = useRef(onExitStart);
  onDoneRef.current = onDone;
  onExitStartRef.current = onExitStart;

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

    if (variant) {
      setRenderVariant(variant);
      setRenderSublabel(sublabel);
      setVisible(true);
      holdTimerRef.current = window.setTimeout(() => {
        onExitStartRef.current?.();
        setVisible(false);
        holdTimerRef.current = null;
      }, holdMs);
      return clearHoldTimer;
    }

    setVisible(false);
    return clearHoldTimer;
  }, [variant, sublabel, holdMs]);

  const meta = renderVariant ? CELEBRATION_META[renderVariant] : null;
  const accent = meta?.color ?? "var(--accent)";
  const Icon = meta?.Icon ?? LogIn;
  const label = meta?.label ?? "";
  const sublabelText = renderSublabel ?? meta?.sublabel;

  const enterEase = MOTION_EASE_OUT;
  const exitEase = MOTION_EASE_IN_OUT;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      mode="wait"
      onExitComplete={() => {
        setRenderVariant(null);
        setRenderSublabel(undefined);
        onDoneRef.current?.();
      }}
    >
      {visible && renderVariant && meta ? (
        <motion.div
          key={renderVariant}
          className="pointer-events-none fixed inset-0 z-[40] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: reduceMotion ? 1 : 0.985,
          }}
          transition={{
            opacity: { duration: exitSec, ease: exitEase },
            scale: { duration: exitSec, ease: exitEase },
          }}
          aria-live="polite"
          aria-label={label}
        >
          <motion.div
            className="absolute inset-0 bg-background/45 backdrop-blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: exitSec,
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
            exit={{ scale: 1.15, opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0.12 : exitSec * 1.15,
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
                    ease: enterEase,
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
                      ease: enterEase,
                    }}
                  />
                );
              })
            : null}

          <motion.div
            className="relative flex flex-col items-center gap-3 px-6 text-center"
            variants={{
              initial: {
                opacity: 0,
                y: reduceMotion ? 0 : 12,
                scale: reduceMotion ? 1 : 0.92,
              },
              animate: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: reduceMotion
                  ? { duration: 0.1 }
                  : { type: "spring", stiffness: 360, damping: 28, mass: 0.9 },
              },
              exit: {
                opacity: 0,
                y: reduceMotion ? 0 : -10,
                scale: reduceMotion ? 1 : 0.94,
                transition: { duration: exitSec, ease: exitEase },
              },
            }}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="relative">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 22%, transparent), 0 20px 48px color-mix(in srgb, ${accent} 20%, transparent)`,
                }}
                variants={{
                  initial: { scale: 0.75, opacity: 0 },
                  animate: {
                    scale: 1,
                    opacity: 1,
                    transition: { duration: reduceMotion ? 0.1 : 0.38, delay: 0.04 },
                  },
                  exit: {
                    scale: 0.92,
                    opacity: 0,
                    transition: { duration: exitSec, ease: exitEase },
                  },
                }}
                initial="initial"
                animate="animate"
                exit="exit"
              />
              <motion.div
                className={cn(
                  "relative flex size-24 items-center justify-center rounded-full",
                  "bg-card/95 ring-1 ring-border/50 backdrop-blur-md",
                )}
                variants={{
                  initial: {
                    scale: reduceMotion ? 1 : 0.55,
                    rotate: reduceMotion ? 0 : -6,
                    opacity: 1,
                  },
                  animate: {
                    scale: 1,
                    rotate: 0,
                    transition: reduceMotion
                      ? { duration: 0.1 }
                      : { type: "spring", stiffness: 420, damping: 24, delay: 0.02 },
                  },
                  exit: {
                    scale: reduceMotion ? 1 : 0.9,
                    opacity: 0,
                    transition: { duration: exitSec, ease: exitEase },
                  },
                }}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <motion.div
                  variants={{
                    initial: {
                      scale: reduceMotion ? 1 : 0.6,
                      opacity: reduceMotion ? 1 : 0,
                    },
                    animate: {
                      scale: 1,
                      opacity: 1,
                      transition: reduceMotion
                        ? { duration: 0.1 }
                        : { type: "spring", stiffness: 480, damping: 26, delay: 0.08 },
                    },
                    exit: {
                      scale: 0.85,
                      opacity: 0,
                      transition: { duration: exitSec * 0.9, ease: exitEase },
                    },
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
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
                variants={{
                  initial: { opacity: 0, y: reduceMotion ? 0 : 6 },
                  animate: {
                    opacity: 1,
                    y: 0,
                    transition: {
                      duration: reduceMotion ? 0.1 : 0.36,
                      delay: reduceMotion ? 0 : 0.14,
                      ease: enterEase,
                    },
                  },
                  exit: {
                    opacity: 0,
                    y: reduceMotion ? 0 : -4,
                    transition: { duration: exitSec, ease: exitEase },
                  },
                }}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {label}
              </motion.p>
              {sublabelText ? (
                <motion.p
                  className="text-sm text-muted-foreground"
                  variants={{
                    initial: { opacity: 0, y: reduceMotion ? 0 : 4 },
                    animate: {
                      opacity: 1,
                      y: 0,
                      transition: {
                        duration: reduceMotion ? 0.1 : 0.36,
                        delay: reduceMotion ? 0 : 0.22,
                        ease: enterEase,
                      },
                    },
                    exit: {
                      opacity: 0,
                      y: reduceMotion ? 0 : -3,
                      transition: { duration: exitSec, ease: exitEase },
                    },
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {sublabelText}
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

/** Zeiterfassungs-Varianten — dünner Alias für Modul-Nutzung. */
export function DisplayTimeActionCelebration({
  action,
  onDone,
}: {
  action: DisplayTimeCelebrationAction | null;
  onDone?: () => void;
}) {
  return <DisplayCelebrationOverlay variant={action} onDone={onDone} />;
}
