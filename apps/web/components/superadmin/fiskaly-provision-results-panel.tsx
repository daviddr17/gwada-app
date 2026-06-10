"use client";

import type { FiskalyProvisionResult } from "@/lib/superadmin/fiskaly-provision-api";
import { formatFiskalyProvisionResultLine } from "@/lib/superadmin/fiskaly-provision-api";
import { cn } from "@/lib/utils";

export function FiskalyProvisionResultsPanel({
  results,
  locationNames,
}: {
  results: FiskalyProvisionResult[];
  locationNames: Record<string, string>;
}) {
  if (!results.length) return null;

  return (
    <div className="mt-3 rounded-xl border border-border/50 bg-background px-3 py-2.5">
      <p className="text-xs font-medium text-foreground">Ergebnis</p>
      <ul className="mt-2 space-y-1.5">
        {results.map((result) => {
          const name = locationNames[result.restaurantId] ?? result.restaurantId;
          const line = formatFiskalyProvisionResultLine(result, name);
          return (
            <li
              key={result.restaurantId}
              className={cn(
                "text-xs leading-snug",
                result.ok
                  ? "text-emerald-800 dark:text-emerald-200"
                  : "text-destructive dark:text-red-300",
              )}
            >
              {result.ok ? "✓" : "✗"} {line}
              {!result.ok && result.suggestReconcile ? (
                <span className="ml-1 text-amber-800 dark:text-amber-200">
                  — Abgleich empfohlen
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
