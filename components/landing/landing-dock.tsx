"use client";

import {
  BookOpen,
  CreditCard,
  Home,
  LayoutGrid,
  LogIn,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  onNavigateSection: (id: string) => void;
};

const dockItems = [
  { id: "home" as const, label: "Home", shortLabel: "Home", icon: Home },
  {
    id: "features" as const,
    label: "Funktionen",
    shortLabel: "Funktionen",
    icon: LayoutGrid,
  },
  { id: "pricing" as const, label: "Preise", shortLabel: "Preise", icon: CreditCard },
  {
    id: "docs" as const,
    label: "Dokumentation",
    shortLabel: "Doku",
    icon: BookOpen,
  },
] as const;

/** Explizit für Safari — `isolation`/`overflow`/`transform` am Parent brechen backdrop-filter oft. */
const glassBlur: CSSProperties = {
  WebkitBackdropFilter: "blur(48px) saturate(1.85)",
  backdropFilter: "blur(48px) saturate(1.85)",
};

const dockItemClass = cn(
  "flex h-auto min-h-[3.1rem] min-w-[3rem] max-w-[4.75rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-foreground/85 hover:bg-black/6 hover:text-foreground sm:min-h-[3.25rem] sm:min-w-[3.35rem] sm:px-1.5 sm:py-1.5 dark:hover:bg-white/10",
);

/**
 * Floating Dock — nur ein <button> bzw. Link pro Eintrag (kein TooltipTrigger,
 * der sonst ein zweites <button> erzeugt → Hydration / invalid HTML).
 */
export function LandingDock({ onNavigateSection }: Props) {
  const glassPlate = cn(
    "pointer-events-none absolute inset-0 z-0 rounded-[1.35rem] sm:rounded-[1.5rem]",
    "border border-white/45 bg-white/58",
    "shadow-[0_12px_40px_-12px_rgba(0,0,0,0.28)]",
    "ring-1 ring-black/8 dark:ring-white/12",
    "dark:border-white/18 dark:bg-black/50",
    "dark:shadow-[0_14px_44px_-12px_rgba(0,0,0,0.65)]",
    /* Fallback, falls backdrop-filter nicht greift */
    "supports-[backdrop-filter]:bg-white/42 supports-[backdrop-filter]:dark:bg-black/38",
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div className="pointer-events-auto relative flex items-end gap-0.5 rounded-[1.35rem] sm:rounded-[1.5rem]">
        <div className={glassPlate} style={glassBlur} aria-hidden />
        <nav
          className="relative z-[1] flex items-end gap-0.5 bg-transparent px-1 py-1.5 sm:px-1.5 sm:py-1.5"
          aria-label="Schnellnavigation"
        >
          {dockItems.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              title={item.label}
              className={dockItemClass}
              aria-label={item.label}
              onClick={() => onNavigateSection(item.id)}
            >
              <item.icon className="size-[17px] shrink-0 sm:size-[18px]" strokeWidth={1.85} />
              <span className="w-full text-center text-[8px] font-medium leading-tight tracking-tight text-foreground/90 sm:text-[9px]">
                {item.shortLabel}
              </span>
            </Button>
          ))}

          <Button
            variant="ghost"
            title="Zur Anmeldung"
            className={dockItemClass}
            aria-label="Anmelden"
            nativeButton={false}
            render={<Link href="/login" prefetch scroll={false} />}
          >
            <LogIn className="size-[17px] shrink-0 sm:size-[18px]" strokeWidth={1.85} />
            <span className="w-full text-center text-[8px] font-medium leading-tight tracking-tight text-foreground/90 sm:text-[9px]">
              Anmelden
            </span>
          </Button>
        </nav>
      </div>
    </div>
  );
}
