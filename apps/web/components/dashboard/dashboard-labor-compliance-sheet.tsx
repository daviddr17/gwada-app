"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import type { LaborComplianceViolation } from "@/lib/staff/labor-law/de-arbzg-rules";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { applyLaborComplianceBulkFix } from "@/lib/staff/labor-law/apply-labor-compliance-fix";
import { toast } from "sonner";

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

  const filtered = useMemo(() => {
    return violations.filter((v) => {
      if (fromYmd && v.dayYmd < fromYmd) return false;
      if (toYmd && v.dayYmd > toYmd) return false;
      return v.code === "missing_break" || v.code === "break_too_short";
    });
  }, [violations, fromYmd, toYmd]);

  const staffLabel = (staffId: string) => {
    const row = staffById.get(staffId);
    if (!row) return "Mitarbeiter";
    return `${row.given_name} ${row.family_name}`.trim();
  };

  const runFix = async () => {
    if (!restaurantId || filtered.length === 0) return;
    setBusy(true);
    try {
      const result = await applyLaborComplianceBulkFix({
        restaurantId,
        violations: filtered,
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
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" aria-hidden />
              Arbeitszeit-Hinweise (ArbZG)
            </DrawerTitle>
            <DrawerDescription>
              Unverbindliche Prüfung auf Basis des ArbZG. Keine Rechtsberatung.
              Tarifverträge können abweichen. Display-Mitarbeiter sehen diese
              Hinweise nicht.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 overflow-y-auto px-4 pb-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="labor-from">Von (optional)</Label>
                <Input
                  id="labor-from"
                  type="date"
                  value={fromYmd}
                  onChange={(e) => setFromYmd(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="labor-to">Bis (optional)</Label>
                <Input
                  id="labor-to"
                  type="date"
                  value={toYmd}
                  onChange={(e) => setToYmd(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Korrektur-Modus</Label>
              <Select
                value={fixMode}
                onValueChange={(v) => {
                  if (v === "normal" || v === "extend_end") setFixMode(v);
                }}
              >
                <SelectTrigger
                  className={appSelectTriggerAccentCn("h-10 w-full rounded-xl")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">
                    Pause verbuchen (Netto-Arbeitszeit kürzer)
                  </SelectItem>
                  <SelectItem value="extend_end">
                    Pause verbuchen + Ende verlängern (Dokumentation)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine behebbaren Pausen-Verstöße im gewählten Zeitraum.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {filtered.map((v, i) => (
                  <li
                    key={`${v.staffId}-${v.dayYmd}-${v.code}-${i}`}
                    className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2"
                  >
                    <p className="font-medium">
                      {staffLabel(v.staffId)} · {v.dayYmd}
                    </p>
                    <p className="text-muted-foreground">{v.message}</p>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              className={brandActionButtonRoundedClassName}
              disabled={filtered.length === 0 || !restaurantId}
              onClick={() => setConfirmOpen(true)}
            >
              {filtered.length} Verstoß
              {filtered.length === 1 ? "" : "e"} beheben
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Zeiteinträge wirklich ändern?"
        description={`Es werden ${filtered.length} Pausen-Einträge angelegt${fixMode === "extend_end" ? " und betroffene Arbeitsblöcke am Ende verlängert" : ""}. Bestehende Verträge und andere Daten bleiben unberührt.`}
        confirmLabel={busy ? "Wird geändert…" : "Ja, jetzt ändern"}
        destructive={false}
        confirmDisabled={busy}
        onConfirm={() => runFix()}
      />
    </>
  );
}
