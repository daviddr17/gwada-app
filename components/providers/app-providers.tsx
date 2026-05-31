"use client";

import { ThemeProvider } from "next-themes";
import { PlatformFaviconSync } from "@/components/layout/platform-favicon-sync";
import { PlatformAppBrandingProvider } from "@/lib/contexts/platform-app-branding-context";
import { SuppressExpectedSupabaseNetworkNoise } from "@/components/providers/suppress-expected-supabase-network-noise";
import { SupabaseDatabaseGate } from "@/components/providers/supabase-database-gate";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarketingAuthRouteTransition } from "@/components/layout/marketing-auth-route-transition";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={false}
    >
      <SuppressExpectedSupabaseNetworkNoise />
      <PlatformAppBrandingProvider>
        <PlatformFaviconSync />
        <Toaster />
        <SupabaseDatabaseGate>
          <TooltipProvider>
            <MarketingAuthRouteTransition />
            {children}
          </TooltipProvider>
        </SupabaseDatabaseGate>
      </PlatformAppBrandingProvider>
    </ThemeProvider>
  );
}
