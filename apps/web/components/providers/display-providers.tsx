"use client";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlatformAppBrandingProvider } from "@/lib/contexts/platform-app-branding-context";
import type { PlatformAppBranding } from "@/lib/types/platform-app-settings";

/** Display-Routen: Theme (View Transition) + Plattform-Branding für Logo-Hell/Dunkel. */
export function DisplayProviders({
  children,
  initialBranding,
}: {
  children: React.ReactNode;
  initialBranding?: PlatformAppBranding | null;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider>
        <PlatformAppBrandingProvider initialBranding={initialBranding}>
          {children}
        </PlatformAppBrandingProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
