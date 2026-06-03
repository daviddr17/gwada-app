"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const transition = {
  duration: 0.38,
  ease: [0.22, 1, 0.36, 1] as const,
};

/** Sonne ↔ Mond mit Wechsel-Animation (Light = Mond sichtbar, Dark = Sonne). */
export function ThemeModeIcon({
  isDark,
  className,
}: {
  isDark: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <span
      className={cn("relative inline-flex size-4 shrink-0", className)}
      aria-hidden
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="sun"
            className="absolute inset-0 flex items-center justify-center"
            initial={
              reduceMotion
                ? false
                : { opacity: 0, scale: 0.35, rotate: -72, filter: "blur(4px)" }
            }
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.35, rotate: 72, filter: "blur(4px)" }
            }
            transition={reduceMotion ? { duration: 0 } : transition}
          >
            <Sun className="size-4" />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            className="absolute inset-0 flex items-center justify-center"
            initial={
              reduceMotion
                ? false
                : { opacity: 0, scale: 0.35, rotate: 72, filter: "blur(4px)" }
            }
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.35, rotate: -72, filter: "blur(4px)" }
            }
            transition={reduceMotion ? { duration: 0 } : transition}
          >
            <Moon className="size-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
