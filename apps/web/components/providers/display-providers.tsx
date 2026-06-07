"use client";

import { EmbedProviders } from "@/components/providers/embed-providers";
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
    <EmbedProviders>
      <PlatformAppBrandingProvider initialBranding={initialBranding}>
        {children}
      </PlatformAppBrandingProvider>
    </EmbedProviders>
  );
}
