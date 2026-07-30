"use client";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Embed-/Einladungs-Routen: helles Theme erzwingen (iOS iframes).
 * Öffentliches Profil und Display nutzen eigene Provider ohne forcedTheme.
 */
export function EmbedProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
