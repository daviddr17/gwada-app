"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type IntegrationCollapsiblePanelProps = {
  title: ReactNode;
  description: string;
  icon: ReactNode;
  badges?: ReactNode;
  /** Rechts im Kopf (z. B. Schalter) — Klicks klappen nicht um. */
  headerTrailing?: ReactNode;
  defaultOpen?: boolean;
  loading?: boolean;
  loadingSkeleton?: ReactNode;
  children?: ReactNode;
  /** Sichtbar in der Kopfzeile auch eingeklappt (z. B. verbundene Nummer). */
  collapsedSummary?: ReactNode;
  /** Inhalt oberhalb von children im geöffneten Bereich (z. B. Hinweis). */
  openHeaderExtra?: ReactNode;
};

/**
 * Einklappbare Integrations-Karte — einheitlicher Hover über die volle Kopfzeile
 * (kein abgesetzter Innen-Bereich wie bei rounded-lg + negativem Margin).
 */
export function IntegrationCollapsiblePanel({
  title,
  description,
  icon,
  badges,
  headerTrailing,
  defaultOpen = false,
  loading,
  loadingSkeleton,
  children,
  collapsedSummary,
  openHeaderExtra,
}: IntegrationCollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (loading && loadingSkeleton) {
    return loadingSkeleton;
  }

  return (
    <Card className="overflow-hidden border-border/50 shadow-card">
      <div
        className={cn(
          "flex w-full items-start gap-3 sm:gap-4",
          open && children != null && "border-b border-border/40",
        )}
      >
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 items-start gap-4 p-4 text-left outline-none transition-colors",
            "hover:bg-muted/50 focus-visible:bg-muted/50",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          )}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/50",
              "bg-muted/30 [&_svg]:size-5",
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 pr-1">
              <CardTitle className="text-base font-semibold leading-tight">
                {title}
              </CardTitle>
              {badges}
            </div>
            {!open ? (
              <>
                {collapsedSummary ? (
                  <p className="text-sm text-muted-foreground">{collapsedSummary}</p>
                ) : null}
                <CardDescription className="line-clamp-2 text-sm">
                  {description}
                </CardDescription>
              </>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              "mt-1 size-5 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {headerTrailing ? (
          <div
            className="shrink-0 self-start p-4 pl-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {headerTrailing}
          </div>
        ) : null}
      </div>

      {open ? (
        <CardContent className="space-y-4 px-4 pb-4 pt-4">
          <CardDescription className="text-sm">{description}</CardDescription>
          {openHeaderExtra}
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}
