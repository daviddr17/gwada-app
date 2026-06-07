"use client";

import Link from "next/link";
import { Menu, Settings, X } from "lucide-react";
import { useState } from "react";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  tenantName?: string;
  className?: string;
};

export function AppHeader({ tenantName = "Gwada", className }: AppHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-backdrop-filter:bg-background/70",
        className,
      )}
    >
      <div className="mx-auto flex h-[3.25rem] max-w-3xl items-center justify-between gap-3 px-4 sm:h-14 sm:max-w-4xl sm:px-6">
        <Button
          variant="ghost"
          className="h-auto px-0 text-lg font-semibold tracking-tight hover:bg-transparent"
          render={<Link href="/dashboard" prefetch />}
          nativeButton={false}
        >
          <span className="text-foreground">{tenantName}</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-10 rounded-full border-border/60 bg-card/80 shadow-none dark:shadow-sm md:hidden"
            aria-label={mobileOpen ? "Menü schließen" : "Menü öffnen"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="hidden size-10 rounded-full border-border/60 bg-card/80 shadow-none dark:shadow-sm md:inline-flex"
            aria-label="Einstellungen"
            render={<Link href="/settings" />}
            nativeButton={false}
          >
            <Settings className="size-4" />
          </Button>

          <ModeToggle />
        </div>
      </div>

      {mobileOpen && (
        <>
          <Separator />
          <nav className="px-4 py-3 md:hidden">
            <Button
              variant="ghost"
              className="h-11 w-full justify-start gap-3 rounded-xl"
              render={<Link href="/settings" onClick={() => setMobileOpen(false)} />}
              nativeButton={false}
            >
              <Settings className="size-4" />
              Einstellungen
            </Button>
          </nav>
        </>
      )}
    </header>
  );
}
