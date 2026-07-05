"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  computeAutoTableAssignments,
  previewAutoTableAssignments,
  type AutoAssignReservation,
} from "@/lib/reservations/auto-table-assignment";
import type { DiningTableRow } from "@/lib/supabase/dining-floor-db";
import { updateReservationDiningTable } from "@/lib/supabase/reservations-db";
import { dispatchDashboardReservationUpdateLivePatch } from "@/lib/dashboard/dispatch-dashboard-reservation-save-live-client";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { reservationsDayDrawerHeaderActionButtonClassName } from "@/components/reservations/reservations-day-drawer-toolbar";
import { cn } from "@/lib/utils";

type AutoAssignTablesButtonProps = {
  reservations: AutoAssignReservation[];
  tables: DiningTableRow[];
  variant?: "display" | "dashboard";
  className?: string;
  size?: "default" | "sm" | "icon";
  onDone?: () => void;
};

export function AutoAssignTablesButton({
  reservations,
  tables,
  variant = "dashboard",
  className,
  size = "sm",
  onDone,
}: AutoAssignTablesButtonProps) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { restaurantId } = useWorkspaceRestaurantUuid();

  const preview = useMemo(
    () => previewAutoTableAssignments(reservations, tables),
    [reservations, tables],
  );

  const runAssign = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (variant === "display") {
        const res = await fetch("/api/display/reservations/auto-assign", {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json()) as { error?: string; updated?: number };
        if (!res.ok) {
          toast.error(
            data.error === "session_expired"
              ? "Sitzung abgelaufen."
              : "Automatische Verteilung fehlgeschlagen.",
          );
          return;
        }
        const n = data.updated ?? 0;
        toast.success(
          n > 0
            ? `${n} Tischzuordnung${n === 1 ? "" : "en"} aktualisiert.`
            : "Keine neuen Tischzuordnungen nötig.",
        );
        onDone?.();
        return;
      }

      const assignments = computeAutoTableAssignments(reservations, tables);
      if (assignments.size === 0) {
        toast.success("Keine neuen Tischzuordnungen nötig.");
        onDone?.();
        return;
      }

      let updated = 0;
      for (const [id, tableId] of assignments) {
        const { error } = await updateReservationDiningTable(id, tableId);
        if (error) {
          toast.error(error.message);
          return;
        }
        updated += 1;
      }
      toast.success(
        `${updated} Tischzuordnung${updated === 1 ? "" : "en"} aktualisiert.`,
      );
      if (restaurantId) {
        dispatchDashboardReservationUpdateLivePatch(restaurantId);
      }
      onDone?.();
    } catch {
      toast.error("Automatische Verteilung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const handleClick = () => {
    if (busy || tables.length === 0) return;
    setConfirmOpen(true);
  };

  const confirmDescription = (
    <>
      <span className="block">
        Bestehende Tischzuordnungen bleiben unverändert — es werden nur noch nicht
        zugeordnete bestätigte Reservierungen verteilt.
      </span>
      {preview.preservedCount > 0 ? (
        <span className="mt-2 block">
          {preview.preservedCount} Reservierung
          {preview.preservedCount === 1 ? "" : "en"} behält
          {preview.preservedCount === 1 ? "" : "en"} den bisherigen Tisch.
        </span>
      ) : null}
      {preview.toAssignCount > 0 ? (
        <span className="mt-2 block font-medium text-foreground">
          {preview.toAssignCount} neue Zuordnung
          {preview.toAssignCount === 1 ? "" : "en"} werden vorgeschlagen.
        </span>
      ) : preview.unassignedEligibleCount > 0 ? (
        <span className="mt-2 block">
          Für {preview.unassignedEligibleCount} offene Reservierung
          {preview.unassignedEligibleCount === 1 ? "" : "en"} konnte kein passender
          Tisch gefunden werden.
        </span>
      ) : (
        <span className="mt-2 block">Alle bestätigten Reservierungen haben bereits einen Tisch.</span>
      )}
    </>
  );

  const buttonDisabled = busy || tables.length === 0;

  const confirmDialog = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Tische automatisch zuordnen?"
      description={confirmDescription}
      destructive={false}
      confirmLabel="Ja, zuordnen"
      cancelLabel="Abbrechen"
      confirmDisabled={busy || preview.toAssignCount === 0}
      onConfirm={runAssign}
    />
  );

  if (size === "icon") {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            reservationsDayDrawerHeaderActionButtonClassName,
            className,
          )}
          disabled={buttonDisabled}
          aria-label="Tische automatisch zuordnen"
          onClick={handleClick}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LayoutGrid className="size-4" />
          )}
        </Button>
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        className={cn("rounded-xl", className)}
        disabled={buttonDisabled}
        onClick={handleClick}
      >
        {busy ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <LayoutGrid className="mr-2 size-4" />
        )}
        Tische auto-zuordnen
      </Button>
      {confirmDialog}
    </>
  );
}
