"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MOTION_EASE_OUT } from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";

type DashboardHeuteAllClearProps = {
  phase: "checking" | "clear";
  /** Erhöhen, um den Haken erneut zu zeichnen (z. B. erneuter Dashboard-Besuch). */
  replayKey: number;
};

/**
 * Dieselbe Karte von der ersten Anzeige an: erst ruhig „wird geprüft“,
 * dann Farbwechsel und Haken — ohne Ausblenden und Aufblitzen.
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
        "flex w-full items-center gap-3 rounded-xl border px-3 py-3 transition-[background-color,border-color,box-shadow] duration-500 ease-out sm:gap-4 sm:px-4 sm:py-3.5",
        clear
          ? "border-emerald-500/35 bg-emerald-500/[0.07] shadow-[0_0_0_1px_rgba(16,185,129,0.04)] dark:border-emerald-400/30 dark:bg-emerald-500/10"
          : "border-border/50 bg-muted/25 shadow-none",
      )}
      role="status"
      aria-live="polite"
      aria-busy={!clear}
    >
      <span className="sr-only">
        {clear
          ? "Alles erledigt. Kein Handlungsbedarf — du bist auf dem aktuellen Stand."
          : "Wird geprüft. Schaue, ob heute noch etwas offen ist."}
      </span>
      <StatusMark clear={clear} replayKey={replayKey} reduceMotion={reduceMotion} />

      <div className="grid min-w-0 flex-1" aria-hidden>
        <StatusCopy
          active={!clear}
          title="Wird geprüft"
          body="Schaue, ob heute noch etwas offen ist."
          reduceMotion={reduceMotion}
        />
        <StatusCopy
          active={clear}
          title="Alles erledigt"
          body="Kein Handlungsbedarf — du bist auf dem aktuellen Stand."
          reduceMotion={reduceMotion}
        />
      </div>
    </div>
  );
}

function StatusCopy({
  active,
  title,
  body,
  reduceMotion,
}: {
  active: boolean;
  title: string;
  body: string;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      className="col-start-1 row-start-1"
      initial={false}
      animate={{
        opacity: active ? 1 : 0,
        y: reduceMotion ? 0 : active ? 0 : -3,
      }}
      transition={{ duration: reduceMotion ? 0 : 0.32, ease: MOTION_EASE_OUT }}
      aria-hidden={!active}
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
        <motion.span
          key={`glow-${replayKey}`}
          className="absolute inset-0 rounded-full bg-emerald-500/25"
          initial={{ scale: 0.82, opacity: 0.45 }}
          animate={{ scale: 1.32, opacity: 0 }}
          transition={{ duration: 0.85, ease: MOTION_EASE_OUT, delay: 0.18 }}
          aria-hidden
        />
      ) : null}
      {!clear && !reduceMotion ? (
        <motion.span
          className="absolute inset-1 rounded-full bg-foreground/5"
          animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.92, 1, 0.92] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
      ) : null}
      <svg
        viewBox="0 0 24 24"
        className={cn(
          "relative size-11 transition-colors duration-500 ease-out sm:size-12",
          clear
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground/35",
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
        />
        <motion.path
          key={replayKey}
          d="M8 12.5 10.5 15 16 9.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: clear ? 1 : 0,
            opacity: clear ? 1 : 0,
          }}
          transition={{
            duration: reduceMotion ? 0 : 0.42,
            ease: MOTION_EASE_OUT,
            delay: clear && !reduceMotion ? 0.16 : 0,
          }}
        />
      </svg>
    </div>
  );
}
