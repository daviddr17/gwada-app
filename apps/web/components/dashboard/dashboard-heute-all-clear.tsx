"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MOTION_EASE_OUT } from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";

type DashboardHeuteAllClearProps = {
  phase: "checking" | "clear";
  /** Erhöhen, um den Haken erneut zu zeichnen (z. B. erneuter Dashboard-Besuch). */
  replayKey: number;
};

const RING = 2 * Math.PI * 9;

/**
 * Dieselbe Karte von der ersten Anzeige an: erst ruhig „wird geprüft“,
 * dann weicher Farbwechsel, Ring schließt sich, Haken zeichnet sich.
 */
export function DashboardHeuteAllClear({
  phase,
  replayKey,
}: DashboardHeuteAllClearProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const clear = phase === "clear";

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-3 transition-[background-color,border-color,box-shadow] duration-700 ease-out sm:gap-4 sm:px-4 sm:py-3.5",
        clear
          ? "border-emerald-500/35 bg-emerald-500/[0.07] shadow-[0_0_0_1px_rgba(16,185,129,0.06)] dark:border-emerald-400/30 dark:bg-emerald-500/10"
          : "border-border/50 bg-muted/25 shadow-none",
      )}
      role="status"
      aria-live="polite"
      aria-busy={!clear}
    >
      <StatusMark clear={clear} replayKey={replayKey} reduceMotion={reduceMotion} />
      <p className="sr-only">
        {clear
          ? "Alles erledigt. Kein Handlungsbedarf — du bist auf dem aktuellen Stand."
          : "Wird geprüft. Schaue, ob heute noch etwas offen ist."}
      </p>
      <div className="grid min-w-0 flex-1" aria-hidden>
        <CopyBlock
          show={!clear}
          title="Wird geprüft"
          body="Schaue, ob heute noch etwas offen ist."
          reduceMotion={reduceMotion}
        />
        <CopyBlock
          show={clear}
          title="Alles erledigt"
          body="Kein Handlungsbedarf — du bist auf dem aktuellen Stand."
          reduceMotion={reduceMotion}
        />
      </div>
    </div>
  );
}

function CopyBlock({
  show,
  title,
  body,
  reduceMotion,
}: {
  show: boolean;
  title: string;
  body: string;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      className="col-start-1 row-start-1 min-w-0"
      initial={false}
      animate={{
        opacity: show ? 1 : 0,
        y: reduceMotion ? 0 : show ? 0 : 6,
      }}
      transition={{ duration: reduceMotion ? 0 : 0.45, ease: MOTION_EASE_OUT }}
      style={{ pointerEvents: show ? "auto" : "none" }}
      aria-hidden={!show}
    >
      <p className="text-sm font-semibold text-foreground sm:text-[0.9375rem]">
        {title}
      </p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{body}</p>
    </motion.div>
  );
}

function StatusMark({
  clear,
  replayKey,
  reduceMotion,
}: {
  clear: boolean;
  replayKey: number;
  reduceMotion: boolean;
}) {
  return (
    <div className="relative flex size-11 shrink-0 items-center justify-center sm:size-12">
      {clear && !reduceMotion ? (
        <>
          <motion.span
            key={`glow-a-${replayKey}`}
            className="absolute inset-0 rounded-full bg-emerald-500/30"
            initial={{ scale: 0.72, opacity: 0.55 }}
            animate={{ scale: 1.55, opacity: 0 }}
            transition={{ duration: 1.05, ease: MOTION_EASE_OUT, delay: 0.08 }}
            aria-hidden
          />
          <motion.span
            key={`glow-b-${replayKey}`}
            className="absolute inset-1 rounded-full bg-emerald-400/25"
            initial={{ scale: 0.86, opacity: 0.4 }}
            animate={{ scale: 1.28, opacity: 0 }}
            transition={{ duration: 0.85, ease: MOTION_EASE_OUT, delay: 0.22 }}
            aria-hidden
          />
        </>
      ) : null}
      <svg
        viewBox="0 0 24 24"
        className={cn(
          "relative size-11 transition-colors duration-700 ease-out sm:size-12",
          clear
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground/45",
        )}
        aria-hidden
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="opacity-25"
        />
        <motion.circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeDasharray={`${RING * 0.28} ${RING * 0.72}`}
          style={{ transformOrigin: "12px 12px", transformBox: "fill-box" }}
          initial={false}
          animate={
            reduceMotion
              ? { opacity: clear ? 0 : 0.85, rotate: 0 }
              : { opacity: clear ? 0 : 1, rotate: clear ? 0 : 360 }
          }
          transition={
            clear || reduceMotion
              ? { opacity: { duration: reduceMotion ? 0 : 0.35, ease: MOTION_EASE_OUT }, rotate: { duration: 0 } }
              : {
                  rotate: { duration: 1.7, repeat: Infinity, ease: "linear" },
                  opacity: { duration: 0.25 },
                }
          }
        />
        <motion.circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          initial={false}
          animate={{ opacity: clear ? 1 : 0 }}
          transition={{
            opacity: { duration: reduceMotion ? 0 : 0.45, ease: MOTION_EASE_OUT, delay: clear && !reduceMotion ? 0.12 : 0 },
          }}
        />
        {clear ? (
          <motion.path
            key={replayKey}
            d="M8 12.5 10.5 15 16 9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: reduceMotion ? 1 : 0, opacity: reduceMotion ? 1 : 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              pathLength: {
                duration: reduceMotion ? 0 : 0.5,
                ease: MOTION_EASE_OUT,
                delay: reduceMotion ? 0 : 0.28,
              },
              opacity: { duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : 0.22 },
            }}
          />
        ) : null}
      </svg>
    </div>
  );
}
