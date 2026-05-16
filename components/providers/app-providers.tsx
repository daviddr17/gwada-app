"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccentColorProvider } from "@/lib/contexts/accent-color-context";
import { RestaurantProfileProvider } from "@/lib/contexts/restaurant-profile-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={false}
    >
      <AccentColorProvider>
        <RestaurantProfileProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </RestaurantProfileProvider>
      </AccentColorProvider>
    </ThemeProvider>
  );
}
