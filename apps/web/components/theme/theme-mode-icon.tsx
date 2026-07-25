"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sonne ↔ Mond mit CSS-Übergang (kein Framer — kleiner Public/App-Chunk). */
export function ThemeModeIcon({
  isDark,
  className,
}: {
  isDark: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-flex size-4 shrink-0", className)}
      aria-hidden
    >
      <Sun
        className={cn(
          "absolute inset-0 size-4 transition-[opacity,transform,filter] duration-300 ease-out motion-reduce:transition-none",
          isDark
            ? "scale-100 rotate-0 opacity-100 blur-0"
            : "scale-50 -rotate-45 opacity-0 blur-[2px]",
        )}
      />
      <Moon
        className={cn(
          "absolute inset-0 size-4 transition-[opacity,transform,filter] duration-300 ease-out motion-reduce:transition-none",
          isDark
            ? "scale-50 rotate-45 opacity-0 blur-[2px]"
            : "scale-100 rotate-0 opacity-100 blur-0",
        )}
      />
    </span>
  );
}
