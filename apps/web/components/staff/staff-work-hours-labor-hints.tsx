"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import type { LaborComplianceViolation } from "@/lib/staff/labor-law/de-arbzg-rules";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { cn } from "@/lib/utils";

/** Kompakter Monats-Hinweis — Details nur unter „Beheben“. */
export function StaffWorkHoursLaborBanner({
  violations,
  className,
}: {
  violations: LaborComplianceViolation[];
  staffLabelById?: ReadonlyMap<string, string>;
  className?: string;
}) {
  if (violations.length === 0) return null;

  const errorCount = violations.filter((v) => v.severity === "error").length;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 shadow-card",
        className,
      )}
    >
      <AlertTriangle
        className="size-4 shrink-0 text-amber-600"
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-sm break-words">
        <span className="font-medium">
          {violations.length} Hinweis{violations.length === 1 ? "" : "e"}
        </span>
        {errorCount > 0 ? (
          <span className="text-muted-foreground">
            {" "}
            · {errorCount} kritisch
          </span>
        ) : null}
        <span className="text-muted-foreground">
          {" · "}
          <AppNavLink
            href={APP_ROUTES.mitarbeiter.hoursFix}
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Beheben
          </AppNavLink>
        </span>
      </p>
    </div>
  );
}

/** Nur rotes Ausrufezeichen am Tag — keine ausführliche Meldung im Kalender. */
export function StaffWorkHoursDayLaborAlert({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <AppNavLink
      href={APP_ROUTES.mitarbeiter.hoursFix}
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-destructive",
        className,
      )}
      title={`${count} ArbZG-Hinweis${count === 1 ? "" : "e"} — Details unter Beheben`}
      aria-label={`${count} ArbZG-Hinweis${count === 1 ? "" : "e"}, Beheben öffnen`}
    >
      <AlertCircle className="size-4" aria-hidden />
    </AppNavLink>
  );
}
