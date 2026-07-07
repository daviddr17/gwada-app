"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Coffee, Hand, LogIn, LogOut, TimerReset } from "lucide-react";
import {
  DISPLAY_CELEBRATION_ENTER_MS,
  DISPLAY_CELEBRATION_ENTER_REDUCED_MS,
  DISPLAY_CELEBRATION_HOLD_MS,
  DISPLAY_CELEBRATION_HOLD_REDUCED_MS,
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
  | "sign_out"
  | "todo_complete"
  | "todo_defer"
  | "time_request_accepted"
  | "time_request_declined";

export type DisplayTodoGateCelebrationVariant = "todo_complete" | "todo_defer";

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
    label: "Bis gleich",
    sublabel: "Schöne Pause",
    color: "#3b82f6",
    Icon: Coffee,
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
  todo_complete: {
    label: "Erledigt",
    sublabel: "Gut dokumentiert",
    color: "#22c55e",
    Icon: CheckCircle2,
  },
  todo_defer: {
    label: "Verschoben",
    sublabel: "Beim nächsten Mal",
    color: "#64748b",
    Icon: TimerReset,
  },
  time_request_accepted: {
    label: "Anfrage freigegeben",
    sublabel: "Eintrag übernommen",
    color: "#22c55e",
    Icon: CheckCircle2,
  },
  time_request_declined: {
    label: "Anfrage abgelehnt",
    sublabel: "Bitte Teamleitung ansprechen",
    color: "#64748b",
    Icon: TimerReset,
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
  const fadeMs = reduceMotion
    ? DISPLAY_CELEBRATION_ENTER_REDUCED_MS
    : DISPLAY_CELEBRATION_ENTER_MS;
  const fadeSec = fadeMs / 1000;
  const fadeEase = MOTION_EASE_OUT;
  const fadeTransition = {
    duration: fadeSec,
    ease: fadeEase,
  } as const;

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
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.985 }}
          transition={{
            opacity: fadeTransition,
            scale: fadeTransition,
          }}
          aria-live="polite"
          aria-label={label}
        >
          <motion.div
            className="absolute inset-0 bg-background/45 backdrop-blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
          />

          <motion.div
            className="pointer-events-none absolute size-72 rounded-full opacity-50 blur-3xl"
            style={{
              background: `radial-gradient(circle, color-mix(in srgb, ${accent} 50%, transparent) 0%, transparent 68%)`,
            }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1.35, opacity: 0.55 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={fadeTransition}
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
                    ease: fadeEase,
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
                      ease: fadeEase,
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
                y: reduceMotion ? 0 : 12,
                scale: reduceMotion ? 1 : 0.92,
                transition: fadeTransition,
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
                    scale: 0.75,
                    opacity: 0,
                    transition: fadeTransition,
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
                    scale: reduceMotion ? 1 : 0.55,
                    rotate: reduceMotion ? 0 : -6,
                    opacity: 0,
                    transition: fadeTransition,
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
                      scale: reduceMotion ? 1 : 0.6,
                      opacity: 0,
                      transition: fadeTransition,
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
                      ease: fadeEase,
                    },
                  },
                  exit: {
                    opacity: 0,
                    y: reduceMotion ? 0 : 6,
                    transition: {
                      ...fadeTransition,
                      delay: reduceMotion ? 0 : sublabelText ? 0.08 : 0,
                    },
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
                        ease: fadeEase,
                      },
                    },
                    exit: {
                      opacity: 0,
                      y: reduceMotion ? 0 : 4,
                      transition: fadeTransition,
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

/** Checklisten-Gate (PIN / Schicht) — gleiche Celebration wie Zeiterfassung. */
export function DisplayTodoGateCelebration({
  variant,
  onExitStart,
  onDone,
}: {
  variant: DisplayTodoGateCelebrationVariant | null;
  onExitStart?: () => void;
  onDone?: () => void;
}) {
  return (
    <DisplayCelebrationOverlay
      variant={variant}
      onExitStart={onExitStart}
      onDone={onDone}
    />
  );
}

/** Zeiterfassungs-Varianten — dünner Alias für Modul-Nutzung. */
export function DisplayTimeActionCelebration({
  action,
  onExitStart,
  onDone,
}: {
  action: DisplayTimeCelebrationAction | null;
  onExitStart?: () => void;
  onDone?: () => void;
}) {
  return (
    <DisplayCelebrationOverlay
      variant={action}
      onExitStart={onExitStart}
      onDone={onDone}
    />
  );
}
