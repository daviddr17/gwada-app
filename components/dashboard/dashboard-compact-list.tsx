"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function DashboardCompactList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border/50 rounded-xl border border-border/50", className)}>
      {children}
    </ul>
  );
}

export function DashboardCompactListItem({
  href,
  title,
  meta,
  trailing,
  className,
}: {
  href?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {meta ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
        ) : null}
      </div>
      {trailing ? (
        <div className="shrink-0 text-xs text-muted-foreground">{trailing}</div>
      ) : null}
    </>
  );

  const rowClass = cn(
    "flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
    href && "hover:bg-muted/30",
    className,
  );

  if (href) {
    return (
      <li>
        <Link href={href} prefetch className={rowClass}>
          {inner}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <div className={rowClass}>{inner}</div>
    </li>
  );
}

export function DashboardCompactInlineMetrics({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DashboardCompactMetricPill({
  label,
  value,
  href,
  highlight,
}: {
  label: string;
  value: string;
  href?: string;
  highlight?: boolean;
}) {
  const className = cn(
    "inline-flex min-w-0 flex-col rounded-lg border px-2.5 py-1.5 text-left",
    highlight
      ? "border-accent/35 bg-accent/8"
      : "border-border/50 bg-muted/15",
    href && "transition-colors hover:border-accent/40 hover:bg-muted/25",
  );

  const content = (
    <>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} prefetch className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
