"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MOTION_EASE_OUT } from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";

type DashboardHeuteAllClearProps = {
  /** Erhöhen, um die Eintritts-Animation erneut abzuspielen (z. B. Dashboard-Besuch). */
  replayKey: number;
};

export function DashboardHeuteAllClear({ replayKey }: DashboardHeuteAllClearProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const ringDuration = reduceMotion ? 0 : 0.55;
  const checkDelay = reduceMotion ? 0 : 0.42;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-emerald-500/35",
        "bg-emerald-500/[0.07] px-3 py-3 sm:gap-4 sm:px-4 sm:py-3.5",
        "dark:border-emerald-400/30 dark:bg-emerald-500/10",
      )}
      role="status"
      aria-live="polite"
    >
      <motion.div
        key={replayKey}
        className="relative flex size-11 shrink-0 items-center justify-center sm:size-12"
        initial={reduceMotion ? false : { scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: MOTION_EASE_OUT }}
      >
        {!reduceMotion ? (
          <motion.span
            className="absolute inset-0 rounded-full bg-emerald-500/25"
            initial={{ scale: 0.55, opacity: 0.55 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.95, ease: MOTION_EASE_OUT, delay: 0.08 }}
            aria-hidden
          />
        ) : null}
        <svg
          viewBox="0 0 24 24"
          className="size-11 text-emerald-600 dark:text-emerald-400 sm:size-12"
          aria-hidden
        >
          <motion.circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.35 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: ringDuration, ease: MOTION_EASE_OUT }}
          />
          <motion.path
            d="M8 12.5 10.5 15 16 9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              duration: reduceMotion ? 0 : 0.38,
              ease: MOTION_EASE_OUT,
              delay: checkDelay,
            }}
          />
        </svg>
      </motion.div>

      <div className="min-w-0">
        <motion.p
          key={`title-${replayKey}`}
          className="text-sm font-semibold text-foreground sm:text-[0.9375rem]"
          initial={reduceMotion ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: checkDelay + 0.08,
            duration: 0.32,
            ease: MOTION_EASE_OUT,
          }}
        >
          Alles erledigt
        </motion.p>
        <motion.p
          key={`meta-${replayKey}`}
          className="mt-0.5 text-xs leading-snug text-muted-foreground"
          initial={reduceMotion ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: checkDelay + 0.16,
            duration: 0.32,
            ease: MOTION_EASE_OUT,
          }}
        >
          Kein Handlungsbedarf — du bist auf dem aktuellen Stand.
        </motion.p>
      </div>
    </div>
  );
}
