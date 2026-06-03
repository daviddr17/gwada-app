"use client";

import { ModeToggle } from "@/components/theme/mode-toggle";
import { cn } from "@/lib/utils";

/** Fixierter Theme-Schalter für Display-Vollbild (PIN, Modulauswahl, …). */
export function DisplayThemeToggleSlot({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed top-4 right-4 z-50 sm:top-6 sm:right-6",
        className,
      )}
    >
      <div className="pointer-events-auto">
        <ModeToggle
          className="size-11 rounded-full border-border/60 bg-card/90 shadow-none backdrop-blur-sm dark:shadow-sm"
        />
      </div>
    </div>
  );
}
