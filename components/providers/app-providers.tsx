"use client";

import { ThemeProvider } from "next-themes";
import { SuppressExpectedSupabaseNetworkNoise } from "@/components/providers/suppress-expected-supabase-network-noise";
import { SupabaseDatabaseGate } from "@/components/providers/supabase-database-gate";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={false}
    >
      <SuppressExpectedSupabaseNetworkNoise />
      <Toaster />
      <SupabaseDatabaseGate>
        <TooltipProvider>{children}</TooltipProvider>
      </SupabaseDatabaseGate>
    </ThemeProvider>
  );
}
