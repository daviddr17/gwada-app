"use client";

import type { ComponentProps } from "react";
import { useTheme } from "@/components/providers/theme-provider";
import { ThemeModeIcon } from "@/components/theme/theme-mode-icon";
import { runThemeTransition } from "@/lib/ui/theme-transition";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const modeToggleClassName =
  "shrink-0 rounded-full border-border/60 bg-card/80 shadow-none backdrop-blur-sm dark:shadow-sm";

export function ModeToggle({
  className,
  size = "icon",
}: {
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size={size}
        className={cn(
          modeToggleClassName,
          size === "icon" && "size-10",
          className,
        )}
        aria-label="Theme laden"
        disabled
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn(
        modeToggleClassName,
        size === "icon" && "size-10",
        className,
      )}
      aria-label={isDark ? "Hellmodus" : "Dunkelmodus"}
      onClick={() => {
        const next = isDark ? "light" : "dark";
        runThemeTransition(() => setTheme(next));
      }}
    >
      <ThemeModeIcon isDark={isDark} />
    </Button>
  );
}
