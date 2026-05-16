"use client";

import Link from "next/link";
import { Settings, UserRound } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-svh min-w-0 overflow-x-clip">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl supports-backdrop-filter:bg-background/70">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-6" />
          <div className="flex flex-1 items-center justify-end gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-full border-border/60"
              aria-label="Persönliches Profil"
              render={<Link href="/profile" prefetch />}
            >
              <UserRound className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-full border-border/60"
              aria-label="Einstellungen"
              render={<Link href="/settings" prefetch />}
            >
              <Settings className="size-4" />
            </Button>
            <ModeToggle />
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
