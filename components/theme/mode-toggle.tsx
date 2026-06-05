"use client";

import { useTheme } from "@/components/providers/theme-provider";
import { ThemeModeIcon } from "@/components/theme/theme-mode-icon";
import { runThemeTransition } from "@/lib/ui/theme-transition";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ModeToggle({ className }: { className?: string }) {
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
        size="icon"
        className={cn(
          "size-10 shrink-0 rounded-full border-border/60 bg-card/80",
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
      size="icon"
      className={cn(
        "size-10 shrink-0 rounded-full border-border/60 bg-card/80 shadow-none backdrop-blur-sm dark:shadow-sm",
        className,
      )}
      aria-label={isDark ? "Hellmodus" : "Dunkelmodus"}
      onClick={() => {
        const next = isDark ? "light" : "dark";
        runThemeTransition(() => {
          flushSync(() => setTheme(next));
        });
      }}
    >
      <ThemeModeIcon isDark={isDark} />
    </Button>
  );
}
