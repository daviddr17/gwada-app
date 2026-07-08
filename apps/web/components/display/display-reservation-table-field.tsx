"use client";

import { useMemo, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { DisplayReservationRow } from "@/lib/display/display-reservations-server";
import {
  formatDiningTableSelectLabel,
  type DiningTableRow,
} from "@/lib/supabase/dining-floor-db";
import {
  checkTableAssignmentForSave,
  suggestAlternativeTables,
  type TableAssignmentCheck,
} from "@/lib/reservations/reservation-table-conflicts";
import { reservationStatusAllowsTableAssignment } from "@/lib/reservations/reservation-table-assignment";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

function toKnownRow(r: DisplayReservationRow) {
  return {
    id: r.id,
    party_size: r.party_size,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    dining_table_id: r.dining_table_id,
    reservation_statuses: r.status ? { code: r.status.code } : null,
  };
}

export function DisplayReservationTableField({
  reservation,
  tables,
  reservations,
  disabled,
  compact = false,
  showSuggestions = true,
  onUpdated,
}: {
  reservation: DisplayReservationRow;
  tables: DiningTableRow[];
  reservations: DisplayReservationRow[];
  disabled?: boolean;
  compact?: boolean;
  showSuggestions?: boolean;
  onUpdated: (tableId: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [sharePending, setSharePending] = useState<{
    tableId: string;
    detail: Extract<TableAssignmentCheck, { kind: "confirm_share" }>;
  } | null>(null);
  const shareConfirmedRef = useRef(false);

  const value = reservation.dining_table_id ?? "__none__";
  const isUnassigned = !reservation.dining_table_id;

  const canAssign = reservationStatusAllowsTableAssignment(
    reservation.status ? { code: reservation.status.code } : null,
  );

  const knownRows = useMemo(
    () =>
      reservations.map((r) => toKnownRow(r)) as Parameters<
        typeof checkTableAssignmentForSave
      >[0]["knownReservations"],
    [reservations],
  );

  const tableOptions = useMemo(() => {
    const items = [{ value: "__none__", label: "Kein Tisch" }];
    for (const t of tables) {
      items.push({ value: t.id, label: formatDiningTableSelectLabel(t) });
    }
    return items;
  }, [tables]);

  const selectedLabel = useMemo(() => {
    if (value === "__none__") return "Kein Tisch";
    const t = tables.find((x) => x.id === value);
    if (t) return formatDiningTableSelectLabel(t);
    const fromReservation = reservation.table;
    if (fromReservation) return formatDiningTableSelectLabel(fromReservation);
    return "Tisch";
  }, [value, tables, reservation.table]);

  const assignmentParams = useMemo(
    () => ({
      partySize: reservation.party_size,
      startsAt: reservation.starts_at,
      endsAt: reservation.ends_at,
      excludeReservationId: reservation.id,
      tables,
      knownReservations: knownRows,
    }),
    [reservation, tables, knownRows],
  );

  const suggestions = useMemo(() => {
    if (!isUnassigned || !canAssign) return [];
    return suggestAlternativeTables(assignmentParams);
  }, [isUnassigned, canAssign, assignmentParams]);

  const check = useMemo(() => {
    if (!reservation.dining_table_id) return { kind: "ok" as const };
    return checkTableAssignmentForSave({
      tableId: reservation.dining_table_id,
      ...assignmentParams,
    });
  }, [reservation.dining_table_id, assignmentParams]);

  const persistTable = async (nextId: string | null) => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/display/reservations/${encodeURIComponent(reservation.id)}/table`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dining_table_id: nextId }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (data.error === "table_requires_confirmed") {
          toast.error("Tischzuordnung nur bei Status „Bestätigt“ oder „Am Tisch“.");
        } else {
          toast.error("Tisch konnte nicht gespeichert werden.");
        }
        return false;
      }
      onUpdated(nextId);
      return true;
    } catch {
      toast.error("Tisch konnte nicht gespeichert werden.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const applyTable = async (nextRaw: string, options?: { skipShareConfirm?: boolean }) => {
    const nextId = nextRaw === "__none__" ? null : nextRaw;
    if (nextId === reservation.dining_table_id) return;

    if (nextId) {
      const preview = checkTableAssignmentForSave({
        tableId: nextId,
        ...assignmentParams,
      });
      if (preview.kind === "capacity_exceeded") {
        toast.error(preview.message);
        return;
      }
      if (preview.kind === "confirm_share" && !options?.skipShareConfirm) {
        setSharePending({ tableId: nextId, detail: preview });
        return;
      }
    }

    await persistTable(nextId);
  };

  const handleShareDialogOpenChange = (open: boolean) => {
    if (open) return;
    shareConfirmedRef.current = false;
    setSharePending(null);
  };

  if (!canAssign) {
    if (compact) {
      return null;
    }
    return (
      <p className="text-xs text-muted-foreground">
        Tischzuordnung nur bei Status „Bestätigt“ oder „Am Tisch“.
      </p>
    );
  }

  return (
    <div className={cn(compact ? "space-y-0" : "space-y-1.5")}>
      <Select
        value={value}
        items={tableOptions}
        disabled={disabled || busy}
        onValueChange={(v) => void applyTable(String(v))}
      >
        <SelectTrigger
          className={appSelectTriggerAccentCn(
            compact
              ? "h-8 w-full min-w-0 rounded-lg text-xs"
              : "h-10 w-full min-w-[10rem] rounded-xl",
            selectValueNoShrink,
          )}
        >
          <SelectValue placeholder="Tisch">{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {tableOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {check.kind === "capacity_exceeded" && !compact ? (
        <p className="text-xs text-destructive">{check.message}</p>
      ) : null}
      {check.kind === "confirm_share" && !compact ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Am Tisch „{check.tableLabel}“ sind zur gleichen Zeit bereits{" "}
          {check.seatUsed} von {check.capacity} Plätzen belegt — es passen noch{" "}
          {check.remaining} Personen.
        </p>
      ) : null}

      {showSuggestions && isUnassigned && suggestions.length > 0 ? (
        <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Vorschläge:</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((alt) => (
              <Button
                key={alt.tableId}
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "h-8 rounded-lg text-xs",
                  alt.kind === "free" && "border-accent/40",
                )}
                disabled={busy}
                onClick={() => void applyTable(alt.tableId, { skipShareConfirm: false })}
              >
                {alt.label}
                {alt.kind === "share" ? (
                  <span className="ml-1 text-muted-foreground">(teilen)</span>
                ) : null}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={sharePending !== null}
        onOpenChange={handleShareDialogOpenChange}
        title="Tisch bereits belegt — zusammensetzen?"
        destructive={false}
        confirmLabel="Ja, zusammenlegen"
        cancelLabel="Abbrechen"
        confirmDisabled={busy}
        description={
          sharePending ? (
            <>
              Am Tisch „{sharePending.detail.tableLabel}“ sind für diesen Zeitraum
              bereits{" "}
              <span className="font-medium text-foreground">
                {sharePending.detail.seatUsed} Person
                {sharePending.detail.seatUsed === 1 ? "" : "en"}
              </span>{" "}
              aus {sharePending.detail.otherCount} Reservierung
              {sharePending.detail.otherCount === 1 ? "" : "en"} zugewiesen
              (Kapazität {sharePending.detail.capacity}, noch{" "}
              {sharePending.detail.remaining} frei). Sie planen{" "}
              {sharePending.detail.partySize} Person
              {sharePending.detail.partySize === 1 ? "" : "en"}.
              <br />
              <br />
              Sollen die Reservierungen wirklich gemeinsam an diesem Tisch platziert
              werden?
            </>
          ) : null
        }
        onConfirm={async () => {
          if (!sharePending) return;
          shareConfirmedRef.current = true;
          await persistTable(sharePending.tableId);
        }}
      />
    </div>
  );
}
