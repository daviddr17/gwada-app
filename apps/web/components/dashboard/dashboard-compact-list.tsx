"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DASHBOARD_METRIC_PRESS_SCALE,
  DASHBOARD_WIDGET_PRESS_SPRING,
} from "@/lib/ui/dashboard-widget-polish";
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
        "overflow-hidden rounded-xl border border-border/40 bg-muted/25 divide-y divide-border/40",
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
  trailingAction,
  leading,
  stripeVariant,
  footnote,
  className,
}: {
  href?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Zusatz unter der Meta-Zeile, z. B. interne Notiz. */
  footnote?: React.ReactNode;
  /** Außerhalb des Links (z. B. Schnell-Aktion), kein Navigieren. */
  trailingAction?: React.ReactNode;
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
          {footnote ? <div className="mt-0.5">{footnote}</div> : null}
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
    "flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left transition-colors",
    stripeVariant ? "pl-2.5" : "pl-4",
    trailingAction ? "pr-2" : "pr-4",
    href && "hover:bg-muted/30",
    className,
  );

  const action = trailingAction ? (
    <div className="flex shrink-0 items-center gap-1 py-1.5 pr-2.5">
      {trailingAction}
    </div>
  ) : null;

  if (href) {
    return (
      <li className="flex items-stretch">
        <AppNavLink href={href} prefetch={false} className={rowClass}>
          {inner}
        </AppNavLink>
        {action}
      </li>
    );
  }

  return (
    <li className="flex items-stretch">
      <div className={rowClass}>{inner}</div>
      {action}
    </li>
  );
}

/** Soft-gruppierte Metrik-Liste (Apple-Settings-Stil) statt loser Pills. */
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
        "overflow-hidden rounded-xl bg-muted/35 divide-y divide-border/35 dark:bg-muted/25",
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
  title,
}: {
  label: string;
  value: string;
  href?: string;
  onClick?: () => void;
  highlight?: boolean;
  stripeVariant?: DashboardCompactStripeVariant;
  icon?: React.ReactNode;
  /** Vollständiger Label-Text (z. B. bei abgekürztem Pill-Label). */
  title?: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const interactive = Boolean(href || onClick);

  const content = (
    <div
      className={cn(
        "flex w-full min-w-0 items-stretch gap-2.5 py-2.5",
        stripeVariant ? "pl-2.5 pr-3.5" : "px-3.5",
      )}
    >
      {stripeVariant ? <DashboardCompactStripe variant={stripeVariant} /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {icon ? <span className="shrink-0 [&_svg]:size-3.5">{icon}</span> : null}
          <span className="truncate" title={title}>
            {label}
          </span>
        </span>
        <span className="text-[0.9375rem] font-semibold tabular-nums tracking-tight text-foreground sm:text-base">
          {value}
        </span>
      </div>
    </div>
  );

  const shellClass = cn(
    "block w-full min-w-0 text-left",
    highlight ? "bg-accent/8" : "bg-transparent",
    interactive &&
      "cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
  );

  if (onClick) {
    if (reduceMotion) {
      return (
        <button type="button" onClick={onClick} className={shellClass}>
          {content}
        </button>
      );
    }
    return (
      <motion.button
        type="button"
        onClick={onClick}
        className={shellClass}
        whileTap={{ scale: DASHBOARD_METRIC_PRESS_SCALE }}
        transition={DASHBOARD_WIDGET_PRESS_SPRING}
      >
        {content}
      </motion.button>
    );
  }

  if (href) {
    if (reduceMotion) {
      return (
        <AppNavLink href={href} prefetch={false} className={shellClass}>
          {content}
        </AppNavLink>
      );
    }
    return (
      <motion.div
        className="origin-center will-change-transform"
        whileTap={{ scale: DASHBOARD_METRIC_PRESS_SCALE }}
        transition={DASHBOARD_WIDGET_PRESS_SPRING}
      >
        <AppNavLink href={href} prefetch={false} className={shellClass}>
          {content}
        </AppNavLink>
      </motion.div>
    );
  }

  return <div className={shellClass}>{content}</div>;
}

export function DashboardCompactMetricPillSkeleton() {
  return (
    <div className="flex w-full items-stretch gap-2.5 px-3.5 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-2.5 w-16 rounded" />
        <Skeleton className="h-4 w-10 rounded-md" />
      </div>
    </div>
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
