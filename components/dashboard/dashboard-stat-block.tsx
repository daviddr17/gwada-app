"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function DashboardStatBlock({
  label,
  primary,
  secondary,
  highlight,
  href,
  onClick,
  size = "compact",
}: {
  label: string;
  primary: string;
  secondary?: ReactNode;
  highlight?: boolean;
  /** Optional: gesamte Kachel als Link (z. B. gefilterte Übersicht). */
  href?: string;
  /** Optional: Kachel als Button (z. B. Bottom-Sheet öffnen). */
  onClick?: () => void;
  size?: "default" | "compact";
}) {
  const compact = size === "compact";
  const inner = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={
          compact
            ? "text-lg font-semibold tabular-nums tracking-tight text-foreground"
            : "text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl"
        }
      >
        {primary}
      </p>
      {secondary ? (
        <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
          {secondary}
        </p>
      ) : null}
    </>
  );

  const className = cn(
    "flex min-w-0 flex-col gap-1 rounded-xl border text-left transition-colors",
    compact ? "p-2.5" : "p-4",
    highlight
      ? "border-accent/35 bg-accent/8"
      : "border-border/50 bg-muted/15",
    (href || onClick) &&
      "cursor-pointer hover:border-accent/40 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} prefetch className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function DashboardWidgetStatsGrid({
  children,
  columns = 3,
}: {
  children: ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

export function DashboardWidgetStatsSkeleton({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <DashboardWidgetStatsGrid columns={compact ? 2 : 3}>
      {Array.from({ length: compact ? 2 : 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "space-y-2 rounded-xl border border-border/50 bg-muted/15",
            compact ? "p-2.5" : "p-4",
          )}
        >
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-9 w-16 rounded-lg" />
          <Skeleton className="h-3 w-32 rounded-md" />
        </div>
      ))}
    </DashboardWidgetStatsGrid>
  );
}
