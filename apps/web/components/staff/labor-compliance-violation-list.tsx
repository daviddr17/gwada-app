"use client";

import { AlertTriangle } from "lucide-react";
import type { LaborComplianceViolation } from "@/lib/staff/labor-law/de-arbzg-rules";
import { cn } from "@/lib/utils";

export function LaborComplianceViolationCard({
  violation,
  staffLabel,
  compact,
}: {
  violation: LaborComplianceViolation;
  staffLabel?: string;
  compact?: boolean;
}) {
  return (
    <li
      className={cn(
        "rounded-xl border px-3 py-2.5",
        violation.severity === "warning"
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={cn(
            "mt-0.5 size-4 shrink-0",
            violation.severity === "warning"
              ? "text-amber-600"
              : "text-destructive",
          )}
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug">
            {violation.title}
            {staffLabel ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {staffLabel}
              </span>
            ) : null}
            {!compact ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {violation.dayYmd}
              </span>
            ) : null}
          </p>
          <p className="text-sm text-foreground/90">{violation.message}</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{violation.legalRef}</span>
            {" · "}
            {violation.hint}
          </p>
          {violation.fixable ? (
            <p className="text-xs font-medium text-accent">Behebbar per Pausen-Korrektur</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function LaborComplianceViolationList({
  violations,
  staffLabelById,
  compact,
  emptyText = "Keine Arbeitszeit-Hinweise in diesem Zeitraum.",
}: {
  violations: LaborComplianceViolation[];
  staffLabelById?: ReadonlyMap<string, string>;
  compact?: boolean;
  emptyText?: string;
}) {
  if (violations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{emptyText}</p>
    );
  }
  return (
    <ul className="space-y-2">
      {violations.map((v, i) => (
        <LaborComplianceViolationCard
          key={`${v.staffId}-${v.dayYmd}-${v.code}-${i}`}
          violation={v}
          staffLabel={staffLabelById?.get(v.staffId)}
          compact={compact}
        />
      ))}
    </ul>
  );
}
