"use client";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Öffentliches Restaurant-Profil (`/[slug]`): Light/Dark umschaltbar.
 * Nicht EmbedProviders — dort ist forcedTheme=light (iOS-Embeds).
 */
export function PublicProfileProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
