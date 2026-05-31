"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmbedSubmitPhase = "idle" | "loading" | "success";

export function EmbedSubmitButton({
  phase,
  idleLabel,
  loadingLabel = "Wird gesendet…",
  disabled,
  onClick,
  className,
}: {
  phase: EmbedSubmitPhase;
  idleLabel: string;
  loadingLabel?: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const isSuccess = phase === "success";
  const isLoading = phase === "loading";

  return (
    <Button
      type="button"
      disabled={disabled || isLoading || isSuccess}
      onClick={onClick}
      className={cn(
        "relative h-11 w-full overflow-hidden rounded-xl transition-colors duration-500",
        isSuccess
          ? "bg-emerald-600 text-white hover:bg-emerald-600"
          : "bg-accent text-accent-foreground hover:bg-accent/90",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isSuccess ? (
          <motion.span
            key="success"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="flex items-center justify-center"
          >
            <Check className="size-6 stroke-[2.5]" aria-hidden />
            <span className="sr-only">Erfolgreich</span>
          </motion.span>
        ) : (
          <motion.span
            key="label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {isLoading ? loadingLabel : idleLabel}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
