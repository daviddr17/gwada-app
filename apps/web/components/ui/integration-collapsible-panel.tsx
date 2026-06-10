"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { integrationPanelAccentBorderColor } from "@/lib/ui/integration-panel-accent";
import { cn } from "@/lib/utils";

type IntegrationCollapsiblePanelProps = {
  title: ReactNode;
  description: string;
  icon: ReactNode;
  badges?: ReactNode;
  /** Plattformfarbe für abgeschwächten Hover-Rand. */
  accentColor?: string;
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
 * Einklappbare Integrations-Karte — volle Kopfzeile klickbar, Plattform-Hover am Rand.
 */
export function IntegrationCollapsiblePanel({
  title,
  description,
  icon,
  badges,
  accentColor,
  headerTrailing,
  defaultOpen = false,
  loading,
  loadingSkeleton,
  children,
  collapsedSummary,
  openHeaderExtra,
}: IntegrationCollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [hovered, setHovered] = useState(false);

  if (loading && loadingSkeleton) {
    return loadingSkeleton;
  }

  const cardStyle: CSSProperties | undefined =
    hovered && accentColor
      ? { borderColor: integrationPanelAccentBorderColor(accentColor) }
      : undefined;

  return (
    <Card
      className={cn(
        "overflow-hidden border border-border/50 py-0 shadow-card transition-[border-color] duration-200",
        "gap-0",
      )}
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className={cn(
          "flex w-full cursor-pointer items-start gap-3 p-4 text-left outline-none transition-colors sm:gap-4",
          "hover:bg-muted/50 focus-visible:bg-muted/50",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          open && children != null && "border-b border-border/40",
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
        {headerTrailing ? (
          <div
            className="shrink-0 self-start pl-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {headerTrailing}
          </div>
        ) : null}
      </button>

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
