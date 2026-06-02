"use client";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Minimal client stack for embed, display, and other lightweight guest routes. */
export function EmbedProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={false}
    >
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
