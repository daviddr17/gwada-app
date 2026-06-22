"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LogOut } from "lucide-react";
import {
  DISPLAY_PIN_REVEAL_MS,
  DISPLAY_PIN_REVEAL_REDUCED_MS,
  MOTION_EASE_OUT,
} from "@/lib/ui/motion-presets";

type DisplaySignOutOverlayProps = {
  open: boolean;
};

/** Kurze Vollbild-Animation beim Abmelden — Gegenstück zur PIN-Entsperrung. */
export function DisplaySignOutOverlay({ open }: DisplaySignOutOverlayProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const revealMs = reduceMotion ? DISPLAY_PIN_REVEAL_REDUCED_MS : DISPLAY_PIN_REVEAL_MS;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="display-sign-out"
          className="pointer-events-auto fixed inset-0 z-[40] flex flex-col items-center justify-center bg-background/70 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: revealMs / 1000,
            ease: MOTION_EASE_OUT,
          }}
          aria-hidden
        >
          <motion.div
            className="relative flex size-24 items-center justify-center rounded-full bg-muted/50 ring-2 ring-muted-foreground/30"
            initial={{ scale: reduceMotion ? 1 : 1.04, opacity: 1 }}
            animate={{ scale: reduceMotion ? 1 : 0.78, opacity: 0.85 }}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { duration: 0.42, ease: MOTION_EASE_OUT }
            }
          >
            <motion.span
              className="absolute size-4 rounded-full bg-accent"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 0, opacity: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0.08 }
                  : { duration: 0.28, ease: MOTION_EASE_OUT }
              }
            />
            <motion.div
              className="flex items-center justify-center"
              initial={{ scale: reduceMotion ? 1 : 0.55, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0.1 }
                  : {
                      type: "spring",
                      stiffness: 420,
                      damping: 26,
                      delay: 0.08,
                    }
              }
            >
              <LogOut className="size-9 text-muted-foreground" strokeWidth={2} />
            </motion.div>
          </motion.div>
          <motion.p
            className="mt-8 text-sm font-medium tracking-wide text-muted-foreground"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { duration: 0.32, ease: MOTION_EASE_OUT, delay: 0.12 }
            }
          >
            Auf Wiedersehen
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
