"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import type { LaborComplianceViolation } from "@/lib/staff/labor-law/de-arbzg-rules";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { applyLaborComplianceBulkFix } from "@/lib/staff/labor-law/apply-labor-compliance-fix";
import { LaborComplianceViolationList } from "@/components/staff/labor-compliance-violation-list";
import { LaborComplianceBulkFixPanel } from "@/components/staff/labor-compliance-bulk-fix-panel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 8;

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

  const fixable = useMemo(
    () => violations.filter((v) => v.fixable),
    [violations],
  );

  const errorCount = useMemo(
    () => violations.filter((v) => v.severity === "error").length,
    [violations],
  );

  const preview = useMemo(
    () => violations.slice(0, PREVIEW_LIMIT),
    [violations],
  );

  const hasMore = violations.length > PREVIEW_LIMIT;

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
            className={cn(
              drawerFormHeaderClassName(4),
              "min-w-0 shrink-0 space-y-3 text-left",
            )}
          >
            <div className="space-y-1">
              <DrawerTitle className="flex items-center gap-2">
                <AlertTriangle
                  className="size-5 shrink-0 text-amber-600"
                  aria-hidden
                />
                <span className="min-w-0">Arbeitszeit-Hinweise</span>
              </DrawerTitle>
              <DrawerDescription className="text-left break-words">
                Unverbindliche ArbZG-Prüfung (letzte 6 Monate) — keine
                Rechtsberatung.
              </DrawerDescription>
            </div>

            <div className="flex flex-wrap gap-2 text-xs tabular-nums">
              <span className="rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 font-medium">
                {violations.length} Hinweise
              </span>
              {errorCount > 0 ? (
                <span className="rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-1 font-medium text-destructive">
                  {errorCount} kritisch
                </span>
              ) : null}
              {fixable.length > 0 ? (
                <span className="rounded-full border border-accent/30 bg-accent/5 px-2.5 py-1 font-medium text-accent">
                  {fixable.length} behebbar
                </span>
              ) : null}
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-between rounded-xl border-border/60"
              render={
                <AppNavLink
                  href={APP_ROUTES.mitarbeiter.hoursFix}
                  onClick={() => onOpenChange(false)}
                />
              }
            >
              <span>Zur Beheben-Übersicht</span>
              <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
            </Button>
          </DrawerHeader>

          <div
            className={drawerScrollAreaClassName(
              4,
              "min-w-0 overflow-x-hidden overscroll-x-none",
            )}
          >
            <p className="mb-2 text-sm font-medium">
              Neueste Hinweise
              {hasMore ? ` (Top ${PREVIEW_LIMIT})` : ""}
            </p>
            <LaborComplianceViolationList
              violations={preview}
              staffLabelById={staffLabelById}
              emptyText="Keine Arbeitszeit-Hinweise."
            />
            {hasMore ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                +{violations.length - PREVIEW_LIMIT} weitere unter{" "}
                <AppNavLink
                  href={APP_ROUTES.mitarbeiter.hoursFix}
                  className="font-medium text-accent underline-offset-4 hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  Beheben
                </AppNavLink>
              </p>
            ) : null}
          </div>

          {fixable.length > 0 ? (
            <DrawerFooter className="min-w-0 shrink-0 gap-0 border-t border-border/50 bg-card px-4 pb-[max(1rem,var(--app-mobile-bottom-safe))] pt-3">
              <LaborComplianceBulkFixPanel
                fixableCount={fixable.length}
                fixMode={fixMode}
                onFixModeChange={setFixMode}
                onFixClick={() => setConfirmOpen(true)}
                disabled={!restaurantId || busy}
                compact
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
        description={`Es werden ${fixable.length} Pausen-Einträge angelegt${fixMode === "extend_end" ? " und betroffene Arbeitsblöcke am Ende verlängert" : ""}. Für gezielte Korrekturen besser die Beheben-Übersicht mit Datumsfilter nutzen.`}
        confirmLabel={busy ? "Wird geändert…" : "Ja, jetzt ändern"}
        destructive={false}
        confirmDisabled={busy}
        onConfirm={() => runFix()}
      />
    </>
  );
}
