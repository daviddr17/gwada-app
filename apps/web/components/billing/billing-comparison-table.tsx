"use client";

import { Check, Minus } from "lucide-react";
import {
  BILLING_COMPARISON_ROWS,
  BILLING_PLANS,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { cn } from "@/lib/utils";

function CellValue({
  value,
  emphasize,
}: {
  value: boolean | string;
  emphasize?: boolean;
}) {
  if (typeof value === "string") {
    return (
      <span
        className={cn(
          "text-sm",
          emphasize ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {value}
      </span>
    );
  }
  if (value) {
    return (
      <Check
        className="mx-auto size-4 text-emerald-600 dark:text-emerald-400"
        aria-label="Enthalten"
      />
    );
  }
  return (
    <Minus
      className="mx-auto size-4 text-muted-foreground/50"
      aria-label="Nicht enthalten"
    />
  );
}

const PLAN_COLS: BillingPlanId[] = ["free", "basic", "pro"];

export function BillingComparisonTable({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-border/50 bg-card/40",
        className,
      )}
    >
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            <th className="px-4 py-3 font-medium text-muted-foreground">
              Leistung
            </th>
            {PLAN_COLS.map((id) => (
              <th
                key={id}
                className={cn(
                  "px-3 py-3 text-center font-semibold",
                  BILLING_PLANS[id].highlight && "text-primary",
                )}
              >
                <div>{BILLING_PLANS[id].name}</div>
                <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                  {BILLING_PLANS[id].price.monthlyEur === 0
                    ? "kostenlos"
                    : `${BILLING_PLANS[id].price.monthlyEur}€/Mo`}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BILLING_COMPARISON_ROWS.map((row) => {
            if (row.type === "section") {
              return (
                <tr key={row.id} className="border-b border-border/40 bg-muted/20">
                  <td
                    colSpan={4}
                    className="px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
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
                )}
              >
                <td className="px-4 py-3 align-middle">
                  <div className="font-medium text-foreground">{row.label}</div>
                  {!compact && row.hint ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.hint}
                    </p>
                  ) : null}
                </td>
                {PLAN_COLS.map((id) => (
                  <td key={id} className="px-3 py-3 text-center align-middle">
                    <CellValue value={row[id]} emphasize={row.highlight} />
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
