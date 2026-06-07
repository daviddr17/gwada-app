"use client";

import { ModeToggle } from "@/components/theme/mode-toggle";
import { cn } from "@/lib/utils";

/** Fixierter Theme-Schalter oben rechts — Landing & öffentliches Restaurant-Profil. */
export function PublicThemeToggleSlot({
  className,
  toggleClassName,
}: {
  className?: string;
  toggleClassName?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed right-5 top-5 z-[60] flex gap-2 md:right-8 md:top-8",
        className,
      )}
    >
      <div className="pointer-events-auto">
        <ModeToggle className={toggleClassName} />
      </div>
    </div>
  );
}
