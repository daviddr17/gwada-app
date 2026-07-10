"use client";

import { CalendarRange, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/combobox";
import { DatePickerField, formScheduleTimeInputFullWidthClassName } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  createStaffAvailabilitySlot,
  deleteStaffAvailabilitySlot,
  fetchStaffAvailabilitySlotsForStaff,
} from "@/lib/supabase/staff-availability-db";
import { formatAvailabilitySlotLabelDe } from "@/lib/staff/shift-plan-availability";
import type {
  RestaurantStaffAvailabilitySlotRow,
  StaffAvailabilitySlotKind,
  StaffAvailabilityWeekday,
} from "@/lib/types/staff-availability";
import {
  STAFF_AVAILABILITY_WEEKDAY_LABELS,
  STAFF_AVAILABILITY_WEEKDAY_ORDER,
} from "@/lib/types/staff-availability";
import { cn } from "@/lib/utils";
import { StaffAvailabilityEditorSkeleton } from "@/components/staff/staff-availability-editor-skeleton";

const kindOptions: SearchableSelectOption[] = [
  { value: "weekly", label: "Wöchentlich (Wochentag)" },
  { value: "date", label: "Bestimmter Tag" },
];

const weekdayOptions: SearchableSelectOption[] =
  STAFF_AVAILABILITY_WEEKDAY_ORDER.map((day) => ({
    value: day,
    label: STAFF_AVAILABILITY_WEEKDAY_LABELS[day],
  }));

type StaffAvailabilityEditorProps = {
  restaurantId: string;
  staffId: string;
  className?: string;
  compact?: boolean;
  /** Display-Zeiterfassung (PIN-Session) — nutzt /api/display/availability. */
  displayApi?: boolean;
};

function mapSlotRow(raw: Record<string, unknown>): RestaurantStaffAvailabilitySlotRow {
  return {
    id: raw.id as string,
    restaurant_id: raw.restaurant_id as string,
    staff_id: raw.staff_id as string,
    weekday: (raw.weekday as StaffAvailabilityWeekday | null) ?? null,
    service_date: (raw.service_date as string | null) ?? null,
    start_time: String(raw.start_time ?? "").slice(0, 8),
    end_time: String(raw.end_time ?? "").slice(0, 8),
    note: (raw.note as string | null) ?? null,
    created_by: (raw.created_by as string | null) ?? null,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  };
}

export function StaffAvailabilityEditor({
  restaurantId,
  staffId,
  className,
  compact = false,
  displayApi = false,
}: StaffAvailabilityEditorProps) {
  const [slots, setSlots] = useState<RestaurantStaffAvailabilitySlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [kind, setKind] = useState<StaffAvailabilitySlotKind>("weekly");
  const [weekday, setWeekday] = useState<StaffAvailabilityWeekday>("monday");
  const [serviceDate, setServiceDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("18:00");
  const [note, setNote] = useState("");

  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    setLoading(true);
    if (displayApi) {
      try {
        const res = await fetch("/api/display/availability", {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await res.json()) as {
          error?: string;
          slots?: Record<string, unknown>[];
        };
        setLoading(false);
        if (!res.ok) {
          toast.error(data.error ?? "Laden fehlgeschlagen.");
          setSlots([]);
          return;
        }
        setSlots((data.slots ?? []).map(mapSlotRow));
      } catch {
        setLoading(false);
        toast.error("Laden fehlgeschlagen.");
        setSlots([]);
      }
      return;
    }

    const { data, error } = await fetchStaffAvailabilitySlotsForStaff(
      restaurantId,
      staffId,
    );
    setLoading(false);
    if (error) {
      toast.error(error);
      setSlots([]);
      return;
    }
    setSlots(data);
  }, [restaurantId, staffId, displayApi]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const weeklySlots = useMemo(
    () => slots.filter((s) => s.weekday != null),
    [slots],
  );
  const dateSlots = useMemo(
    () => slots.filter((s) => s.service_date != null),
    [slots],
  );

  const handleAdd = async () => {
    setSaving(true);
    if (displayApi) {
      try {
        const res = await fetch("/api/display/availability", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            weekday: kind === "weekly" ? weekday : null,
            serviceDate: kind === "date" ? serviceDate : null,
            startTime,
            endTime,
            note: note.trim() || null,
          }),
        });
        const data = (await res.json()) as { error?: string };
        setSaving(false);
        if (!res.ok) {
          toast.error(
            data.error === "invalid_range"
              ? "Ende muss nach Beginn liegen."
              : data.error ?? "Speichern fehlgeschlagen.",
          );
          return;
        }
      } catch {
        setSaving(false);
        toast.error("Speichern fehlgeschlagen.");
        return;
      }
      toast.success("Verfügbarkeit gespeichert.");
      setNote("");
      await reload();
      return;
    }

    const { error } = await createStaffAvailabilitySlot({
      restaurantId,
      staffId,
      kind,
      weekday: kind === "weekly" ? weekday : null,
      serviceDate: kind === "date" ? serviceDate : null,
      startTime,
      endTime,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Verfügbarkeit gespeichert.");
    setNote("");
    await reload();
  };

  const deleteLabel = useMemo(() => {
    const slot = slots.find((s) => s.id === deleteId);
    return slot ? formatAvailabilitySlotLabelDe(slot) : "";
  }, [deleteId, slots]);

  if (showSkeleton) {
    return (
      <StaffAvailabilityEditorSkeleton compact={compact} className={className} />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Card size="sm" className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            {compact ? "Verfügbarkeit" : "Meine Verfügbarkeit"}
          </CardTitle>
          {!compact ? (
            <p className="text-sm text-muted-foreground">
              Trage ein, wann du grundsätzlich oder an bestimmten Tagen arbeiten
              kannst — sichtbar für Planung im Schichtplan.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Verfügbarkeiten hinterlegt.
            </p>
          ) : (
            <div className="space-y-3">
              {weeklySlots.length > 0 ? (
                <SlotGroup
                  title="Wöchentlich"
                  slots={weeklySlots}
                  onDelete={setDeleteId}
                />
              ) : null}
              {dateSlots.length > 0 ? (
                <SlotGroup
                  title="Bestimmte Tage"
                  slots={dateSlots}
                  onDelete={setDeleteId}
                />
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card size="sm" className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Verfügbarkeit hinzufügen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Art</Label>
            <SearchableSelect
              options={kindOptions}
              value={kind}
              onValueChange={(v) => setKind(v as StaffAvailabilitySlotKind)}
              placeholder="Art wählen"
            />
          </div>

          {kind === "weekly" ? (
            <div className="space-y-2">
              <Label>Wochentag</Label>
              <SearchableSelect
                options={weekdayOptions}
                value={weekday}
                onValueChange={(v) => setWeekday(v as StaffAvailabilityWeekday)}
                placeholder="Wochentag"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Datum</Label>
              <DatePickerField
                fullWidth
                value={serviceDate || null}
                onChange={(v) => setServiceDate(v ?? "")}
                placeholder="Datum wählen"
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="availability-start">Von</Label>
              <Input
                id="availability-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={formScheduleTimeInputFullWidthClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="availability-end">Bis</Label>
              <Input
                id="availability-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={formScheduleTimeInputFullWidthClassName}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="availability-note">Notiz (optional)</Label>
            <Input
              id="availability-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z. B. nur Abendservice"
              className="h-11 rounded-xl"
            />
          </div>

          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonFullWidthClassName}
            disabled={saving || (kind === "date" && !serviceDate.trim())}
            onClick={() => void handleAdd()}
          >
            <Plus className="size-4" />
            Hinzufügen
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Verfügbarkeit entfernen?"
        description={
          deleteLabel ? (
            <>
              „<span className="font-medium text-foreground">{deleteLabel}</span>“
              wird entfernt.
            </>
          ) : null
        }
        confirmLabel="Entfernen"
        destructive
        onConfirm={async () => {
          if (!deleteId) return;
          if (displayApi) {
            try {
              const res = await fetch(
                `/api/display/availability?id=${encodeURIComponent(deleteId)}`,
                { method: "DELETE", credentials: "include" },
              );
              const data = (await res.json()) as { error?: string };
              if (!res.ok) {
                toast.error(data.error ?? "Entfernen fehlgeschlagen.");
                return;
              }
            } catch {
              toast.error("Entfernen fehlgeschlagen.");
              return;
            }
          } else {
            const { error } = await deleteStaffAvailabilitySlot(deleteId);
            if (error) {
              toast.error(error);
              return;
            }
          }
          toast.success("Verfügbarkeit entfernt.");
          await reload();
        }}
      />
    </div>
  );
}

function SlotGroup({
  title,
  slots,
  onDelete,
}: {
  title: string;
  slots: RestaurantStaffAvailabilitySlotRow[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1.5">
        {slots.map((slot) => (
          <li
            key={slot.id}
            className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/15 px-3 py-2"
          >
            <CalendarRange
              className="size-3.5 shrink-0 text-accent"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {formatAvailabilitySlotLabelDe(slot)}
              </p>
              {slot.note ? (
                <p className="truncate text-xs text-muted-foreground">
                  {slot.note}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Entfernen"
              onClick={() => onDelete(slot.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
