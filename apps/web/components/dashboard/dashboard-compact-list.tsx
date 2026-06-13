"use client";

import { AppNavLink } from "@/components/navigation/app-nav-link";
import { Skeleton } from "@/components/ui/skeleton";
import { STAFF_WORK_ENTRY_COLORS } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

/** Blau: unbestätigte Reservierungen, ungelesene Nachrichten. */
export type DashboardCompactStripeVariant = "attention" | "active" | "break";

const STRIPE_COLOR: Record<DashboardCompactStripeVariant, string> = {
  attention: "#3b82f6",
  active: STAFF_WORK_ENTRY_COLORS.work,
  break: STAFF_WORK_ENTRY_COLORS.break,
};

/** Höhe = nur Textblock (Label→Zahl bzw. Titel→Meta), nicht die ganze Zeile/Kachel. */
function DashboardCompactStripe({
  variant,
  className,
}: {
  variant: DashboardCompactStripeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn("w-1 shrink-0 self-stretch rounded-full", className)}
      style={{ backgroundColor: STRIPE_COLOR[variant] }}
      aria-hidden
    />
  );
}

export function DashboardCompactList({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <ul
      aria-label={ariaLabel}
      className={cn(
        "overflow-hidden rounded-xl border border-border/50 divide-y divide-border/50",
        className,
      )}
    >
      {children}
    </ul>
  );
}

export function DashboardCompactListItem({
  href,
  title,
  meta,
  trailing,
  leading,
  stripeVariant,
  className,
}: {
  href?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
  stripeVariant?: DashboardCompactStripeVariant;
  className?: string;
}) {
  const inner = (
    <>
      <div className="flex min-w-0 flex-1 items-stretch gap-2">
        {stripeVariant ? <DashboardCompactStripe variant={stripeVariant} /> : null}
        {leading ? (
          <span className="flex shrink-0 self-center [&_svg]:size-4">{leading}</span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {meta ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
          ) : null}
        </div>
      </div>
      {trailing ? (
        <div className="shrink-0 self-center pl-1 text-xs text-muted-foreground">
          {trailing}
        </div>
      ) : null}
    </>
  );

  const rowClass = cn(
    "flex items-center gap-3 py-2.5 text-left transition-colors",
    stripeVariant ? "pl-2.5 pr-4" : "px-4",
    href && "hover:bg-muted/30",
    className,
  );

  if (href) {
    return (
      <li>
        <AppNavLink href={href} prefetch={false} className={rowClass}>
          {inner}
        </AppNavLink>
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
  onClick,
  highlight,
  stripeVariant,
  icon,
}: {
  label: string;
  value: string;
  href?: string;
  onClick?: () => void;
  highlight?: boolean;
  stripeVariant?: DashboardCompactStripeVariant;
  icon?: React.ReactNode;
}) {
  const shellClass = cn(
    "inline-flex min-w-0 rounded-lg border text-left",
    highlight
      ? "border-accent/35 bg-accent/8"
      : "border-border/50 bg-muted/15",
    (href || onClick) &&
      "cursor-pointer transition-colors hover:border-accent/40 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  );

  const content = (
    <div
      className={cn(
        "flex items-stretch gap-2 py-1.5",
        stripeVariant ? "pl-1.5 pr-2.5" : "px-2.5",
      )}
    >
      {stripeVariant ? <DashboardCompactStripe variant={stripeVariant} /> : null}
      <div className="flex min-w-0 flex-col">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {icon ? <span className="shrink-0 [&_svg]:size-3.5">{icon}</span> : null}
          <span className="truncate">{label}</span>
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shellClass}>
        {content}
      </button>
    );
  }

  if (href) {
    return (
      <AppNavLink href={href} prefetch={false} className={shellClass}>
        {content}
      </AppNavLink>
    );
  }

  return <div className={shellClass}>{content}</div>;
}

export function DashboardCompactMetricPillSkeleton() {
  return (
    <Skeleton className="h-[2.625rem] w-[5.5rem] shrink-0 rounded-lg border border-border/50" />
  );
}

export function DashboardCompactListItemSkeleton({
  stripe = false,
}: {
  stripe?: boolean;
}) {
  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-3 py-2.5",
          stripe ? "pl-2.5 pr-4" : "px-4",
        )}
      >
        <div className="flex min-w-0 flex-1 items-stretch gap-2">
          {stripe ? (
            <Skeleton className="w-1 shrink-0 self-stretch rounded-full" />
          ) : null}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5 rounded-md" />
            <Skeleton className="h-3 w-4/5 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-3 w-10 shrink-0 rounded-md" />
      </div>
    </li>
  );
}

export function DashboardCompactListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <DashboardCompactList>
      {Array.from({ length: count }).map((_, i) => (
        <DashboardCompactListItemSkeleton key={i} stripe />
      ))}
    </DashboardCompactList>
  );
}

export function DashboardMessagesTileSkeleton() {
  return (
    <div className="space-y-3">
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPillSkeleton />
      </DashboardCompactInlineMetrics>
      <DashboardCompactListSkeleton count={2} />
    </div>
  );
}

export function DashboardCompactMetricsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden>
      <DashboardCompactInlineMetrics>
        {Array.from({ length: count }).map((_, i) => (
          <DashboardCompactMetricPillSkeleton key={i} />
        ))}
      </DashboardCompactInlineMetrics>
    </div>
  );
}
