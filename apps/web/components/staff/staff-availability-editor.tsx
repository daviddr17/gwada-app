"use client";

import { CalendarOff, CalendarRange, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  DatePickerField,
  formScheduleTimeInputFullWidthClassName,
} from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  createStaffAvailabilityDateSlots,
  deleteStaffAvailabilitySlot,
  fetchStaffAvailabilitySlotsForStaff,
} from "@/lib/supabase/staff-availability-db";
import {
  formatAvailabilitySlotLabelDe,
  isUnavailableAvailabilitySlot,
} from "@/lib/staff/shift-plan-availability";
import {
  buildUpcomingWeekOptions,
  expandWeekdaysInWeeks,
  toggleSortedUnique,
  toggleWeekday,
  type StaffAvailabilityScopeMode,
} from "@/lib/staff/staff-availability-scope";
import type {
  RestaurantStaffAvailabilitySlotRow,
  StaffAvailabilityPolarity,
  StaffAvailabilityWeekday,
} from "@/lib/types/staff-availability";
import {
  STAFF_AVAILABILITY_ALL_DAY_END,
  STAFF_AVAILABILITY_ALL_DAY_START,
  STAFF_AVAILABILITY_WEEKDAY_ORDER,
  STAFF_AVAILABILITY_WEEKDAY_SHORT_LABELS,
} from "@/lib/types/staff-availability";
import { localDayKey, startOfWeekMonday } from "@/lib/staff/shift-schedule-range";
import { cn } from "@/lib/utils";
import { StaffAvailabilityEditorSkeleton } from "@/components/staff/staff-availability-editor-skeleton";

const chipClass = (selected: boolean) =>
  cn(
    "inline-flex shrink-0 items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
    selected
      ? "border-accent/50 bg-accent/15 text-foreground"
      : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
  );

const segmentClass = (selected: boolean) =>
  cn(
    "flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
    selected
      ? "border-accent/50 bg-accent/15 text-foreground"
      : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
  );

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
    is_available: raw.is_available !== false,
    note: (raw.note as string | null) ?? null,
    created_by: (raw.created_by as string | null) ?? null,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  };
}

function formatDateChipDe(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(y!, (m ?? 1) - 1, d ?? 1));
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

  const [polarity, setPolarity] =
    useState<StaffAvailabilityPolarity>("available");
  const [scopeMode, setScopeMode] =
    useState<StaffAvailabilityScopeMode>("dates");
  const [serviceDates, setServiceDates] = useState<string[]>([]);
  const [draftDate, setDraftDate] = useState("");
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(() => [
    localDayKey(startOfWeekMonday(new Date())),
  ]);
  const [selectedWeekdays, setSelectedWeekdays] = useState<
    StaffAvailabilityWeekday[]
  >([...STAFF_AVAILABILITY_WEEKDAY_ORDER]);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("18:00");
  const [note, setNote] = useState("");

  const showSkeleton = useDeferredSkeleton(loading);
  const isUnavailable = polarity === "unavailable";
  const weekOptions = useMemo(() => buildUpcomingWeekOptions(8), []);

  const resolvedDates = useMemo(() => {
    if (scopeMode === "dates") return serviceDates;
    return expandWeekdaysInWeeks(selectedWeeks, selectedWeekdays);
  }, [scopeMode, serviceDates, selectedWeeks, selectedWeekdays]);

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

  const addDraftDate = () => {
    const next = draftDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    setServiceDates((prev) =>
      prev.includes(next) ? prev : [...prev, next].sort(),
    );
    setDraftDate("");
  };

  const handleAdd = async () => {
    if (resolvedDates.length === 0) {
      toast.error(
        scopeMode === "dates"
          ? "Mindestens ein Datum wählen."
          : "Wochen und Wochentage wählen.",
      );
      return;
    }

    setSaving(true);
    const isAvailable = !isUnavailable;
    const effectiveStart = isAvailable
      ? startTime
      : STAFF_AVAILABILITY_ALL_DAY_START;
    const effectiveEnd = isAvailable ? endTime : STAFF_AVAILABILITY_ALL_DAY_END;

    if (displayApi) {
      try {
        const res = await fetch("/api/display/availability", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "date",
            serviceDates: resolvedDates,
            startTime: effectiveStart,
            endTime: effectiveEnd,
            isAvailable,
            note: note.trim() || null,
          }),
        });
        const data = (await res.json()) as { error?: string };
        setSaving(false);
        if (!res.ok) {
          toast.error(
            data.error === "invalid_range"
              ? "Ende muss nach Beginn liegen."
              : data.error === "unavailable_requires_date"
                ? "Nicht verfügbar gilt nur für bestimmte Tage."
                : data.error ?? "Speichern fehlgeschlagen.",
          );
          return;
        }
      } catch {
        setSaving(false);
        toast.error("Speichern fehlgeschlagen.");
        return;
      }
      toast.success(
        isAvailable
          ? resolvedDates.length > 1
            ? `${resolvedDates.length} Verfügbarkeiten gespeichert.`
            : "Verfügbarkeit gespeichert."
          : resolvedDates.length > 1
            ? `${resolvedDates.length} Tage als nicht verfügbar gespeichert.`
            : "Nicht verfügbar gespeichert.",
      );
      setNote("");
      setServiceDates([]);
      setDraftDate("");
      await reload();
      return;
    }

    const { created, error } = await createStaffAvailabilityDateSlots({
      restaurantId,
      staffId,
      serviceDates: resolvedDates,
      startTime: effectiveStart,
      endTime: effectiveEnd,
      isAvailable,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(
      isAvailable
        ? created > 1
          ? `${created} Verfügbarkeiten gespeichert.`
          : "Verfügbarkeit gespeichert."
        : created > 1
          ? `${created} Tage als nicht verfügbar gespeichert.`
          : "Nicht verfügbar gespeichert.",
    );
    setNote("");
    setServiceDates([]);
    setDraftDate("");
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
        {!compact ? (
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Meine Verfügbarkeit
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Trage ein, wann du arbeiten kannst — oder an welchen Tagen nicht.
              Sichtbar für die Planung im Schichtplan.
            </p>
          </CardHeader>
        ) : null}
        <CardContent className={cn("space-y-4", compact && "pt-4")}>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Einträge hinterlegt.
            </p>
          ) : (
            <div className="space-y-3">
              {dateSlots.length > 0 ? (
                <SlotGroup
                  title="Tage"
                  slots={dateSlots}
                  onDelete={setDeleteId}
                />
              ) : null}
              {weeklySlots.length > 0 ? (
                <SlotGroup
                  title="Dauerhaft wöchentlich (Alt)"
                  slots={weeklySlots}
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
            Eintrag hinzufügen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Art</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className={segmentClass(polarity === "available")}
                aria-pressed={polarity === "available"}
                onClick={() => setPolarity("available")}
              >
                Verfügbar
              </button>
              <button
                type="button"
                className={segmentClass(polarity === "unavailable")}
                aria-pressed={polarity === "unavailable"}
                onClick={() => setPolarity("unavailable")}
              >
                Nicht verfügbar
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gilt für</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className={segmentClass(scopeMode === "dates")}
                aria-pressed={scopeMode === "dates"}
                onClick={() => setScopeMode("dates")}
              >
                Einzelne Tage
              </button>
              <button
                type="button"
                className={segmentClass(scopeMode === "weeks")}
                aria-pressed={scopeMode === "weeks"}
                onClick={() => setScopeMode("weeks")}
              >
                Ausgewählte Wochen
              </button>
            </div>
          </div>

          {scopeMode === "dates" ? (
            <div className="space-y-2">
              <Label>Tage</Label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <DatePickerField
                    fullWidth
                    value={draftDate || null}
                    onChange={(v) => setDraftDate(v ?? "")}
                    placeholder="Datum wählen"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0 rounded-xl"
                  disabled={!draftDate.trim()}
                  onClick={addDraftDate}
                >
                  Tag hinzufügen
                </Button>
              </div>
              {serviceDates.length > 0 ? (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {serviceDates.map((ymd) => (
                    <li key={ymd}>
                      <button
                        type="button"
                        className={cn(chipClass(true), "gap-1.5 pr-2")}
                        onClick={() =>
                          setServiceDates((prev) =>
                            prev.filter((d) => d !== ymd),
                          )
                        }
                        aria-label={`${formatDateChipDe(ymd)} entfernen`}
                      >
                        {formatDateChipDe(ymd)}
                        <X className="size-3.5 opacity-70" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ein oder mehrere konkrete Tage auswählen.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Wochen</Label>
                <div className="flex flex-wrap gap-2">
                  {weekOptions.map((week) => {
                    const selected = selectedWeeks.includes(week.weekStartYmd);
                    return (
                      <button
                        key={week.weekStartYmd}
                        type="button"
                        className={chipClass(selected)}
                        aria-pressed={selected}
                        onClick={() =>
                          setSelectedWeeks((prev) =>
                            toggleSortedUnique(prev, week.weekStartYmd),
                          )
                        }
                      >
                        {week.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Wochentage in diesen Wochen</Label>
                <div className="grid grid-cols-7 gap-1.5">
                  {STAFF_AVAILABILITY_WEEKDAY_ORDER.map((day) => {
                    const selected = selectedWeekdays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        className={cn(
                          chipClass(selected),
                          "px-0 py-2 text-xs",
                        )}
                        aria-pressed={selected}
                        onClick={() =>
                          setSelectedWeekdays((prev) =>
                            toggleWeekday(prev, day),
                          )
                        }
                      >
                        {STAFF_AVAILABILITY_WEEKDAY_SHORT_LABELS[day]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Alle Tage = ganze Woche. Sonst z.&nbsp;B. nur Mo und Di in den
                  gewählten Wochen — nicht dauerhaft „jeden Montag“.
                </p>
                {resolvedDates.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {resolvedDates.length}{" "}
                    {resolvedDates.length === 1 ? "Tag" : "Tage"} werden
                    gespeichert.
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {isUnavailable ? (
            <p className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              Ganztägig nicht einsetzbar an den gewählten Tagen.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="availability-start">Von</Label>
                <Input
                  id="availability-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={cn(
                    formScheduleTimeInputFullWidthClassName,
                    "min-w-0",
                  )}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="availability-end">Bis</Label>
                <Input
                  id="availability-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={cn(
                    formScheduleTimeInputFullWidthClassName,
                    "min-w-0",
                  )}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="availability-note">Notiz (optional)</Label>
            <Input
              id="availability-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isUnavailable
                  ? "z. B. familiärer Termin"
                  : "z. B. nur Abendservice"
              }
              className="h-11 rounded-xl"
            />
          </div>

          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonFullWidthClassName}
            disabled={saving || resolvedDates.length === 0}
            onClick={() => void handleAdd()}
          >
            <Plus className="size-4" />
            {resolvedDates.length > 1
              ? `${resolvedDates.length} Tage speichern`
              : "Hinzufügen"}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Eintrag entfernen?"
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
          toast.success("Eintrag entfernt.");
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
        {slots.map((slot) => {
          const unavailable = isUnavailableAvailabilitySlot(slot);
          const Icon = unavailable ? CalendarOff : CalendarRange;
          return (
            <li
              key={slot.id}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/15 px-3 py-2"
            >
              <Icon
                className={cn(
                  "size-3.5 shrink-0",
                  unavailable ? "text-rose-500" : "text-accent",
                )}
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
          );
        })}
      </ul>
    </div>
  );
}
