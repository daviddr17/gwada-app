"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDisplayRestaurantTimezone } from "@/components/display/display-restaurant-timezone-provider";
import type { DisplayReservationRow } from "@/lib/display/display-reservations-server";
import { displayReservationSaveErrorMessage } from "@/lib/display/display-reservation-save-errors";
import {
  buildDisplayReservationSlotIso,
  resolveDisplayReservationDwellMinutes,
} from "@/lib/display/display-reservation-save-times";
import { useDrawerFormKeyboardAssist } from "@/lib/hooks/use-drawer-form-keyboard-assist";
import {
  normalizeBookingTimeStepMinutes,
  snapMinutesToBookingStep,
  type BookingTimeStepMinutes,
} from "@/lib/reservations/booking-time-step";
import { minutesToHHmm } from "@/lib/reservations/day-opening-slots";
import {
  checkTableAssignmentForSave,
  type TableAssignmentCheck,
} from "@/lib/reservations/reservation-table-conflicts";
import { WALK_IN_DEFAULT_LAST_NAME } from "@/lib/reservations/walk-in";
import {
  readRestaurantZonedParts,
  restaurantTodayYmd,
} from "@/lib/restaurant/restaurant-timezone";
import {
  formatDiningTableSelectLabel,
  type DiningTableRow,
} from "@/lib/supabase/dining-floor-db";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  displayDrawerFormFieldClassName,
  displayDrawerFormFooterButtonClassName,
  drawerFormFieldGroupClassName,
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import {
  displayTouchNumericInputProps,
  digitsOnlyInput,
} from "@/lib/ui/touch-numeric-input";
import { cn } from "@/lib/utils";

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

function mapToListRow(
  r: DisplayReservationRow,
  restaurantId: string,
  tables: DiningTableRow[],
): ReservationListRow {
  return {
    id: r.id,
    restaurant_id: restaurantId,
    reservation_number: r.reservation_number,
    guest_pin: "",
    created_at: "",
    created_by_profile_id: null,
    created_by_profile: null,
    guest_first_name: r.guest_first_name,
    guest_last_name: r.guest_last_name,
    guest_phone: r.guest_phone,
    guest_email: r.guest_email,
    contact_id: r.contact_id,
    party_size: r.party_size,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    dining_table_id: r.dining_table_id,
    dwell_minutes: null,
    notify_email: false,
    notify_whatsapp: false,
    terms_accepted: false,
    notes: r.notes ?? null,
    pending_change: null,
    status_before_change_id: null,
    reservation_statuses: r.status
      ? {
          id: r.status.id,
          code: r.status.code,
          name: r.status.name,
          color_hex: r.status.color_hex,
        }
      : null,
    dining_tables: r.table
      ? {
          id: r.table.id,
          table_number: r.table.table_number,
          table_name: r.table.table_name,
          area_id: tables.find((t) => t.id === r.table!.id)?.area_id ?? "",
        }
      : null,
  };
}

export function DisplayWalkInDrawer({
  open,
  onOpenChange,
  tables,
  reservations,
  restaurantId,
  defaultDwellMinutes,
  bookingTimeStepMinutes,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tables: DiningTableRow[];
  reservations: DisplayReservationRow[];
  restaurantId: string;
  defaultDwellMinutes: number;
  bookingTimeStepMinutes: BookingTimeStepMinutes;
  onCreated: (reservation?: DisplayReservationRow | null) => void;
}) {
  const timeZone = useDisplayRestaurantTimezone();
  const scrollRef = useRef<HTMLDivElement>(null);
  useDrawerFormKeyboardAssist({ open, scrollRef });
  const step = normalizeBookingTimeStepMinutes(bookingTimeStepMinutes);

  const [guestName, setGuestName] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [tableId, setTableId] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharePending, setSharePending] = useState<{
    tableId: string;
    detail: Extract<TableAssignmentCheck, { kind: "confirm_share" }>;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setGuestName("");
    setPartySize("2");
    setTableId("");
  }, [open]);

  const knownRows = useMemo(
    () => reservations.map((r) => mapToListRow(r, restaurantId, tables)),
    [reservations, restaurantId, tables],
  );

  const dwellMinutes = useMemo(
    () =>
      resolveDisplayReservationDwellMinutes(
        String(defaultDwellMinutes),
        defaultDwellMinutes,
      ),
    [defaultDwellMinutes],
  );

  const slotIso = useMemo(() => {
    if (dwellMinutes == null) return null;
    const dayYmd = restaurantTodayYmd(timeZone);
    const z = readRestaurantZonedParts(new Date(), timeZone);
    const nowMin = z.hour * 60 + z.minute;
    const timeHm = minutesToHHmm(snapMinutesToBookingStep(nowMin, step));
    return buildDisplayReservationSlotIso(dayYmd, timeHm, dwellMinutes, timeZone, step);
  }, [timeZone, step, dwellMinutes]);

  const tableItems = useMemo(
    () =>
      tables.map((t) => ({
        value: t.id,
        label: formatDiningTableSelectLabel(t),
      })),
    [tables],
  );

  const freeTableIds = useMemo(() => {
    if (!slotIso) return new Set<string>();
    return new Set(
      tables
        .filter((t) => {
          const check = checkTableAssignmentForSave({
            tableId: t.id,
            partySize: Number.parseInt(partySize, 10) || 2,
            startsAt: slotIso.startsIso,
            endsAt: slotIso.endsIso,
            excludeReservationId: null,
            tables,
            knownReservations: knownRows,
          });
          return check.kind === "ok";
        })
        .map((t) => t.id),
    );
  }, [tables, knownRows, slotIso, partySize]);

  const submitWalkIn = async (confirmedTableId: string, allowShare = false) => {
    const ps = Number.parseInt(partySize, 10);
    if (!Number.isFinite(ps) || ps < 1 || ps > 50) {
      toast.error("Personenzahl zwischen 1 und 50.");
      return;
    }
    if (!confirmedTableId) {
      toast.error("Bitte einen Tisch wählen.");
      return;
    }
    if (!slotIso) {
      toast.error("Zeitfenster konnte nicht berechnet werden.");
      return;
    }

    if (!allowShare) {
      const check = checkTableAssignmentForSave({
        tableId: confirmedTableId,
        partySize: ps,
        startsAt: slotIso.startsIso,
        endsAt: slotIso.endsIso,
        excludeReservationId: null,
        tables,
        knownReservations: knownRows,
      });
      if (check.kind === "capacity_exceeded") {
        toast.error(check.message);
        return;
      }
      if (check.kind === "confirm_share") {
        setSharePending({ tableId: confirmedTableId, detail: check });
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/display/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          walk_in: true,
          guest_name: guestName.trim() || null,
          party_size: ps,
          dining_table_id: confirmedTableId,
          starts_at: slotIso.startsIso,
          ends_at: slotIso.endsIso,
          dwell_minutes: dwellMinutes ?? defaultDwellMinutes,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        reservation_number?: number;
        reservation?: DisplayReservationRow;
      };
      if (!res.ok) {
        toast.error(displayReservationSaveErrorMessage(data.error));
        return;
      }
      toast.success(
        data.reservation_number
          ? `Laufkunde #${data.reservation_number} am Tisch.`
          : "Laufkunde platziert.",
      );
      onOpenChange(false);
      onCreated(data.reservation ?? null);
    } catch {
      toast.error("Laufkunde konnte nicht platziert werden.");
    } finally {
      setSaving(false);
      setSharePending(null);
    }
  };

  const fieldClass = displayDrawerFormFieldClassName;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className={drawerContentClassName}>
          <DrawerHeader className={drawerFormHeaderClassName}>
            <DrawerTitle>Laufkunde platzieren</DrawerTitle>
            <DrawerDescription>
              Personenzahl und Tisch wählen — sofort am Tisch, ohne Voranmeldung.
            </DrawerDescription>
          </DrawerHeader>
          <div ref={scrollRef} className={drawerScrollAreaClassName}>
            <div className="space-y-4 px-4 pb-4">
              <div className={drawerFormFieldGroupClassName}>
                <Label htmlFor="walk-in-name" className="text-xs text-muted-foreground">
                  Name (optional)
                </Label>
                <Input
                  id="walk-in-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={WALK_IN_DEFAULT_LAST_NAME}
                  className={fieldClass}
                  autoComplete="off"
                />
              </div>

              <div className={drawerFormFieldGroupClassName}>
                <Label htmlFor="walk-in-party" className="text-xs text-muted-foreground">
                  Personen
                </Label>
                <Input
                  id="walk-in-party"
                  {...displayTouchNumericInputProps}
                  value={partySize}
                  onChange={(e) =>
                    setPartySize(digitsOnlyInput(e.target.value, 2))
                  }
                  className={cn(fieldClass, "tabular-nums")}
                />
              </div>

              {freeTableIds.size > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Freie Tische jetzt</p>
                  <div className="flex flex-wrap gap-2">
                    {tables
                      .filter((t) => freeTableIds.has(t.id))
                      .map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTableId(t.id)}
                          className={cn(
                            "min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition-colors touch-manipulation",
                            tableId === t.id
                              ? "border-accent bg-accent/15 text-foreground"
                              : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50",
                          )}
                        >
                          {formatDiningTableSelectLabel(t)}
                          <span className="ml-1.5 text-xs tabular-nums opacity-70">
                            ({t.capacity})
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}

              <div className={drawerFormFieldGroupClassName}>
                <Label htmlFor="walk-in-table" className="text-xs text-muted-foreground">
                  Tisch
                </Label>
                <Select
                  value={tableId || undefined}
                  onValueChange={(v) => {
                    if (typeof v === "string") setTableId(v);
                  }}
                >
                  <SelectTrigger
                    id="walk-in-table"
                    className={appSelectTriggerAccentCn(
                      cn("h-12 w-full rounded-xl", selectValueNoShrink),
                    )}
                  >
                    <SelectValue placeholder="Tisch wählen …" />
                  </SelectTrigger>
                  <SelectContent>
                    {tableItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="border-t border-border/50 p-4">
            <Button
              type="button"
              size="lg"
              disabled={saving || !tableId}
              className={cn(
                "w-full",
                displayDrawerFormFooterButtonClassName,
                brandActionButtonRoundedClassName,
              )}
              onClick={() => void submitWalkIn(tableId)}
            >
              {saving ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                "Am Tisch platzieren"
              )}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={sharePending !== null}
        onOpenChange={(next) => {
          if (!next) setSharePending(null);
        }}
        title="Tisch teilen?"
        destructive={false}
        description={
          sharePending
            ? `Am Tisch „${sharePending.detail.tableLabel}“ sind bereits ${sharePending.detail.seatUsed} von ${sharePending.detail.capacity} Plätzen belegt. ${sharePending.detail.partySize} Personen dazu platzieren?`
            : undefined
        }
        confirmLabel="Trotzdem platzieren"
        onConfirm={() => {
          if (sharePending) {
            void submitWalkIn(sharePending.tableId, true);
          }
        }}
      />
    </>
  );
}
