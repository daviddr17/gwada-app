"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { DocsNav } from "@/components/docs/docs-nav";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { docsNavCurrentTitle } from "@/lib/docs/docs-navigation";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [navOpen, setNavOpen] = useState(false);
  const currentTitle = docsNavCurrentTitle(pathname);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-[var(--app-chrome-fixed-zone)]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <Link
              href="/"
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ← gwada.app
            </Link>
            <p className="mt-0.5 truncate text-lg font-semibold tracking-tight">
              Dokumentation
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full border-border/60 lg:hidden"
              onClick={() => setNavOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={navOpen}
            >
              <Menu className="size-4" aria-hidden />
              <span className="max-w-[9rem] truncate">{currentTitle}</span>
            </Button>
            <Link
              href="/login"
              className="shrink-0 rounded-lg border border-border/60 px-3 py-1.5 text-sm font-medium hover:bg-muted/30"
            >
              Anmelden
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden space-y-4 lg:sticky lg:top-[5.5rem] lg:block lg:self-start">
          <p className="px-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Inhalt
          </p>
          <DocsNav pathname={pathname} />
        </aside>

        <main className="min-w-0 pb-16">{children}</main>
      </div>

      <Drawer
        direction="bottom"
        open={navOpen}
        onOpenChange={setNavOpen}
        repositionInputs={false}
      >
        <DrawerContent className="max-h-[88dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Inhalt</DrawerTitle>
            <DrawerDescription>
              Aktuell: {currentTitle}. Tippe einen Eintrag, um dorthin zu springen.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            <DocsNav
              pathname={pathname}
              collapsible
              onNavigate={() => setNavOpen(false)}
            />
          </div>
          <DrawerFooter>
            <Button
              type="button"
              className={cn(brandActionButtonRoundedClassName, "w-full")}
              onClick={() => setNavOpen(false)}
            >
              Fertig
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
