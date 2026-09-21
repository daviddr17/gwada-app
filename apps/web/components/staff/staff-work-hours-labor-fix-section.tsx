"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { LaborComplianceViolation } from "@/lib/staff/labor-law/de-arbzg-rules";
import { applyLaborComplianceBulkFix } from "@/lib/staff/labor-law/apply-labor-compliance-fix";
import { LaborComplianceBulkFixPanel } from "@/components/staff/labor-compliance-bulk-fix-panel";

export function StaffWorkHoursLaborFixSection({
  violations,
  restaurantId,
  onFixed,
}: {
  violations: LaborComplianceViolation[];
  restaurantId: string;
  onFixed?: () => void;
}) {
  const [fixMode, setFixMode] = useState<"normal" | "extend_end">("normal");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const fixable = useMemo(
    () => violations.filter((v) => v.fixable),
    [violations],
  );

  const runFix = async () => {
    if (fixable.length === 0) return;
    setBusy(true);
    try {
      const result = await applyLaborComplianceBulkFix({
        restaurantId,
        violations: fixable,
        mode: fixMode,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.fixedCount} Pausen eingetragen${result.skippedCount > 0 ? ` · ${result.skippedCount} übersprungen` : ""}`,
      );
      setConfirmOpen(false);
      onFixed?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <LaborComplianceBulkFixPanel
        fixableCount={fixable.length}
        fixMode={fixMode}
        onFixModeChange={setFixMode}
        onFixClick={() => setConfirmOpen(true)}
        disabled={busy}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Zeiteinträge wirklich ändern?"
        description={`Es werden ${fixable.length} Pausen-Einträge angelegt${fixMode === "extend_end" ? " und betroffene Arbeitsblöcke am Ende verlängert" : ""}. Bestehende Verträge und andere Daten bleiben unberührt.`}
        confirmLabel={busy ? "Wird geändert…" : "Ja, jetzt ändern"}
        destructive={false}
        confirmDisabled={busy}
        onConfirm={() => runFix()}
      />
    </>
  );
}
