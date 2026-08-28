"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { drawerFormHeaderClassName, drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import type { LaborComplianceViolation } from "@/lib/staff/labor-law/de-arbzg-rules";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { applyLaborComplianceBulkFix } from "@/lib/staff/labor-law/apply-labor-compliance-fix";
import { LaborComplianceViolationList } from "@/components/staff/labor-compliance-violation-list";
import { LaborComplianceBulkFixPanel } from "@/components/staff/labor-compliance-bulk-fix-panel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function DashboardLaborComplianceSheet({
  open,
  onOpenChange,
  violations,
  staffById,
  restaurantId,
  onFixed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  violations: LaborComplianceViolation[];
  staffById: ReadonlyMap<string, RestaurantStaffRow>;
  restaurantId: string | null;
  onFixed?: () => void;
}) {
  const [fromYmd, setFromYmd] = useState("");
  const [toYmd, setToYmd] = useState("");
  const [fixMode, setFixMode] = useState<"normal" | "extend_end">("normal");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const staffLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, row] of staffById) {
      map.set(id, `${row.given_name} ${row.family_name}`.trim());
    }
    return map;
  }, [staffById]);

  const filtered = useMemo(() => {
    return violations.filter((v) => {
      if (fromYmd && v.dayYmd < fromYmd) return false;
      if (toYmd && v.dayYmd > toYmd) return false;
      return true;
    });
  }, [violations, fromYmd, toYmd]);

  const fixable = useMemo(
    () => filtered.filter((v) => v.fixable),
    [filtered],
  );

  const runFix = async () => {
    if (!restaurantId || fixable.length === 0) return;
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
      onOpenChange(false);
      onFixed?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className="max-h-[min(90vh,720px)]">
          <DrawerHeader
            className={cn(drawerFormHeaderClassName(4), "min-w-0 shrink-0 text-left")}
          >
            <DrawerTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 shrink-0 text-amber-600" aria-hidden />
              <span className="min-w-0">Arbeitszeit-Hinweise (ArbZG)</span>
            </DrawerTitle>
            <DrawerDescription className="text-left break-words">
              Unverbindliche Prüfung auf Basis des ArbZG (letzte 6 Monate).
              Keine Rechtsberatung — Tarifverträge können abweichen.
              Display-Mitarbeiter sehen diese Hinweise nicht.
            </DrawerDescription>
            <p className="pt-1 text-left text-sm">
              <AppNavLink
                href={APP_ROUTES.mitarbeiter.hours}
                className="font-medium text-accent underline-offset-4 hover:underline"
                onClick={() => onOpenChange(false)}
              >
                In Arbeitszeiten prüfen und korrigieren
              </AppNavLink>
              {" — dort alle Hinweise pro Tag und Bulk-Korrektur für Pausen."}
            </p>
          </DrawerHeader>

          <div
            className={drawerScrollAreaClassName(
              4,
              "min-w-0 overflow-x-hidden overscroll-x-none",
            )}
          >
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="labor-from">Von (optional)</Label>
                <Input
                  id="labor-from"
                  type="date"
                  value={fromYmd}
                  onChange={(e) => setFromYmd(e.target.value)}
                  className="h-10 w-full min-w-0 rounded-xl"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="labor-to">Bis (optional)</Label>
                <Input
                  id="labor-to"
                  type="date"
                  value={toYmd}
                  onChange={(e) => setToYmd(e.target.value)}
                  className="h-10 w-full min-w-0 rounded-xl"
                />
              </div>
            </div>

            <div className="mt-5 min-w-0 space-y-2">
              <p className="text-sm font-medium">
                Alle Hinweise ({filtered.length})
              </p>
              <LaborComplianceViolationList
                violations={filtered}
                staffLabelById={staffLabelById}
              />
            </div>
          </div>

          {fixable.length > 0 ? (
            <DrawerFooter className="min-w-0 shrink-0 gap-3 border-t border-border/50 bg-card px-4 pb-[max(1rem,var(--app-mobile-bottom-safe))] pt-4">
              <LaborComplianceBulkFixPanel
                fixableCount={fixable.length}
                fixMode={fixMode}
                onFixModeChange={setFixMode}
                onFixClick={() => setConfirmOpen(true)}
                disabled={!restaurantId || busy}
                className="w-full min-w-0"
              />
            </DrawerFooter>
          ) : null}
        </DrawerContent>
      </Drawer>
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
