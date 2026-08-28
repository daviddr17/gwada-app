"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { LaborComplianceViolation } from "@/lib/staff/labor-law/de-arbzg-rules";
import { LaborComplianceViolationList } from "@/components/staff/labor-compliance-violation-list";
import { cn } from "@/lib/utils";

export function StaffWorkHoursLaborBanner({
  violations,
  staffLabelById,
  className,
}: {
  violations: LaborComplianceViolation[];
  staffLabelById?: ReadonlyMap<string, string>;
  className?: string;
}) {
  const [open, setOpen] = useState(true);

  if (violations.length === 0) return null;

  const errorCount = violations.filter((v) => v.severity === "error").length;
  const warningCount = violations.length - errorCount;

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/30 bg-amber-500/5 shadow-card",
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-amber-600"
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {violations.length} Arbeitszeit-Hinweis
            {violations.length === 1 ? "" : "e"} in diesem Monat
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {errorCount > 0
              ? `${errorCount} kritisch`
              : "Keine kritischen Verstöße"}
            {warningCount > 0 ? ` · ${warningCount} Hinweis${warningCount === 1 ? "" : "e"}` : ""}
            {" · "}
            Unverbindliche ArbZG-Prüfung — keine Rechtsberatung.
          </span>
        </span>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-amber-500/20 px-4 py-3">
          <LaborComplianceViolationList
            violations={violations}
            staffLabelById={staffLabelById}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}

export function StaffWorkHoursDayLaborHints({
  violations,
  staffLabelById,
}: {
  violations: LaborComplianceViolation[];
  staffLabelById?: ReadonlyMap<string, string>;
}) {
  if (violations.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5">
      <p className="text-xs font-medium text-destructive">
        {violations.length} ArbZG-Hinweis{violations.length === 1 ? "" : "e"}
      </p>
      <LaborComplianceViolationList
        violations={violations}
        staffLabelById={staffLabelById}
        compact
      />
    </div>
  );
}
