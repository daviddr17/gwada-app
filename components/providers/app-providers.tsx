"use client";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { GlobalDocumentTitle } from "@/components/layout/global-document-title";
import { PlatformFaviconSync } from "@/components/layout/platform-favicon-sync";
import { DocumentTitleOverrideProvider } from "@/lib/contexts/document-title-override-context";
import { PlatformAppBrandingProvider } from "@/lib/contexts/platform-app-branding-context";
import { SuppressExpectedSupabaseNetworkNoise } from "@/components/providers/suppress-expected-supabase-network-noise";
import { SupabaseDatabaseGate } from "@/components/providers/supabase-database-gate";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarketingAuthRouteTransition } from "@/components/layout/marketing-auth-route-transition";

export function AppProviders({
  children,
  serverFaviconHref,
}: {
  children: React.ReactNode;
  serverFaviconHref?: string | null;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={false}
    >
      <SuppressExpectedSupabaseNetworkNoise />
      <DocumentTitleOverrideProvider>
        <PlatformAppBrandingProvider>
          <GlobalDocumentTitle />
          <PlatformFaviconSync serverFaviconHref={serverFaviconHref} />
          <Toaster />
          <SupabaseDatabaseGate>
            <TooltipProvider>
              <MarketingAuthRouteTransition />
              {children}
            </TooltipProvider>
          </SupabaseDatabaseGate>
        </PlatformAppBrandingProvider>
      </DocumentTitleOverrideProvider>
    </ThemeProvider>
  );
}
