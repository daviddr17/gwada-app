"use client";

import { Check, Minus } from "lucide-react";
import {
  BILLING_COMPARISON_ROWS,
  BILLING_PLANS,
  priceForInterval,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { cn } from "@/lib/utils";

function CellValue({
  value,
  emphasize,
  proColumn,
}: {
  value: boolean | string;
  emphasize?: boolean;
  proColumn?: boolean;
}) {
  if (typeof value === "string") {
    return (
      <span
        className={cn(
          "text-sm tabular-nums",
          emphasize || proColumn
            ? "font-medium text-foreground"
            : "text-muted-foreground",
        )}
      >
        {value}
      </span>
    );
  }
  if (value) {
    return (
      <span
        className={cn(
          "mx-auto inline-flex size-6 items-center justify-center rounded-full",
          proColumn
            ? "bg-primary/12 text-primary"
            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        )}
      >
        <Check className="size-3.5" strokeWidth={2.5} aria-label="Enthalten" />
      </span>
    );
  }
  return (
    <Minus
      className="mx-auto size-4 text-muted-foreground/35"
      aria-label="Nicht enthalten"
    />
  );
}

const PLAN_COLS: BillingPlanId[] = ["free", "basic", "pro"];

export function BillingComparisonTable({
  className,
  compact,
  interval = "month",
  variant = "default",
}: {
  className?: string;
  compact?: boolean;
  /** Monats-/Jahrespreis in den Spaltenköpfen (effektiv €/Monat). */
  interval?: BillingInterval;
  /** `landing` = stärkere Optik für Marketing. */
  variant?: "default" | "landing";
}) {
  const landing = variant === "landing";

  return (
    <div
      className={cn(
        "overflow-x-auto",
        landing
          ? "rounded-2xl border border-border/60 bg-card/70 shadow-card ring-1 ring-black/[0.03] dark:ring-white/[0.04]"
          : "rounded-xl border border-border/50 bg-card/40",
        className,
      )}
    >
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr
            className={cn(
              "border-b border-border/50",
              landing ? "bg-muted/40" : "bg-muted/30",
            )}
          >
            <th
              className={cn(
                "sticky left-0 z-10 px-4 py-4 font-medium text-muted-foreground backdrop-blur-sm",
                landing ? "bg-muted/40 min-w-[12rem]" : "bg-muted/30",
              )}
            >
              Leistung
            </th>
            {PLAN_COLS.map((id) => {
              const plan = BILLING_PLANS[id];
              const price = priceForInterval(plan.price, interval);
              return (
                <th
                  key={id}
                  className={cn(
                    "px-3 py-4 text-center align-bottom font-semibold",
                    plan.highlight && "text-primary",
                    landing &&
                      plan.highlight &&
                      "bg-primary/[0.06] dark:bg-primary/[0.09]",
                  )}
                >
                  <div className="text-base tracking-tight">{plan.name}</div>
                  <div className="mt-1 text-xs font-normal text-muted-foreground">
                    {price === 0
                      ? "kostenlos"
                      : `${price}€/Mo${interval === "year" ? " · jährlich" : ""}`}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {BILLING_COMPARISON_ROWS.map((row) => {
            if (row.type === "section") {
              return (
                <tr
                  key={row.id}
                  className="border-b border-border/40 bg-muted/25"
                >
                  <td
                    colSpan={4}
                    className={cn(
                      "sticky left-0 z-[1] px-4 py-2.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase backdrop-blur-sm bg-muted/25",
                      landing && "py-3",
                    )}
                  >
                    {row.label}
                  </td>
                </tr>
              );
            }
            return (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border/40 last:border-0",
                  row.highlight && "bg-primary/[0.04]",
                  landing && "hover:bg-muted/20",
                )}
              >
                <td
                  className={cn(
                    "sticky left-0 z-[1] px-4 py-3.5 align-middle backdrop-blur-sm",
                    row.highlight
                      ? "bg-primary/[0.04]"
                      : landing
                        ? "bg-card/90"
                        : "bg-card/40",
                  )}
                >
                  <div className="font-medium text-foreground">{row.label}</div>
                  {!compact && row.hint ? (
                    <p className="mt-0.5 max-w-[18rem] text-xs leading-snug text-muted-foreground">
                      {row.hint}
                    </p>
                  ) : null}
                </td>
                {PLAN_COLS.map((id) => (
                  <td
                    key={id}
                    className={cn(
                      "px-3 py-3.5 text-center align-middle",
                      landing &&
                        BILLING_PLANS[id].highlight &&
                        "bg-primary/[0.04] dark:bg-primary/[0.06]",
                    )}
                  >
                    <CellValue
                      value={row[id]}
                      emphasize={row.highlight}
                      proColumn={BILLING_PLANS[id].highlight}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
