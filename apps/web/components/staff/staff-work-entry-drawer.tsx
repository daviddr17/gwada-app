"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
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
import { formScheduleTimeInputClassName } from "@/components/ui/date-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  fetchStaffWorkEntryLogEntries,
  upsertStaffWorkEntry,
} from "@/lib/supabase/staff-db";
import {
  absenceBlocksWorkTimeMessage,
  isShiftPlanAbsenceEntry,
  isStaffWorkTimeEntryType,
  type ShiftPlanAbsenceEntryType,
} from "@/lib/staff/shift-plan-absence";
import {
  buildStaffWorkEntryChanges,
  formatStaffContractLogActorLabel,
  formatStaffWorkEntryLogDisplaySummary,
  insertStaffWorkEntryLogEntry,
} from "@/lib/staff/staff-work-entry-log";
import { isDisplayWorkEntry } from "@/lib/staff/staff-work-hours-display";
import { validateStaffWorkEntryTiming } from "@/lib/staff/staff-work-entry-validation";
import type {
  RestaurantStaffWorkEntryLogEntry,
  RestaurantStaffWorkEntryRow,
  StaffWorkEntryType,
} from "@/lib/types/staff";
import {
  STAFF_WORK_ENTRY_ITEMS,
  STAFF_WORK_ENTRY_LABELS,
  STAFF_WORK_ENTRY_TYPES,
} from "@/lib/types/staff";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

const logWhenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type StaffWorkEntryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  staffId: string;
  entry: RestaurantStaffWorkEntryRow | null;
  defaultDay: Date | null;
  /** Urlaub/Krank pro Tag — dort keine Arbeitszeit/Pause anlegen. */
  absenceByDayKey?: ReadonlyMap<string, ShiftPlanAbsenceEntryType>;
  allowEdit?: boolean;
  /** Einträge am selben Tag (für Überschneidungs-Validierung). */
  siblingEntries?: readonly RestaurantStaffWorkEntryRow[];
  onSaved: () => void;
  onDelete: (id: string) => Promise<void>;
};

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combineLocal(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

export function StaffWorkEntryDrawer({
  open,
  onOpenChange,
  restaurantId,
  staffId,
  entry,
  defaultDay,
  absenceByDayKey,
  allowEdit = true,
  siblingEntries = [],
  onSaved,
  onDelete,
}: StaffWorkEntryDrawerProps) {
  const [entryType, setEntryType] = useState<StaffWorkEntryType>("work");
  const [dateStr, setDateStr] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [logEntries, setLogEntries] = useState<RestaurantStaffWorkEntryLogEntry[]>(
    [],
  );
  const [logLoading, setLogLoading] = useState(false);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const didAutofocusStartTimeRef = useRef(false);

  const readOnly = !allowEdit;
  const isOpenEntry = Boolean(entry?.is_open);
  const isDisplayEntry = entry != null && isDisplayWorkEntry(entry);

  const reloadLog = useCallback(async () => {
    if (!entry?.id) {
      setLogEntries([]);
      return;
    }
    setLogLoading(true);
    const { data, error } = await fetchStaffWorkEntryLogEntries(restaurantId, [
      entry.id,
    ]);
    setLogLoading(false);
    if (error) {
      toast.error("Protokoll konnte nicht geladen werden.");
      setLogEntries([]);
      return;
    }
    setLogEntries(data);
  }, [entry?.id, restaurantId]);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      const s = new Date(entry.starts_at);
      setEntryType(entry.entry_type);
      setDateStr(toDateInput(s));
      setStartTime(toTimeInput(s));
      setEndTime(
        entry.is_open ? toTimeInput(new Date()) : toTimeInput(new Date(entry.ends_at)),
      );
    } else {
      const day = defaultDay ?? new Date();
      setEntryType("work");
      setDateStr(toDateInput(day));
      setStartTime("09:00");
      setEndTime("17:00");
    }
  }, [open, entry, defaultDay]);

  useEffect(() => {
    if (!open) return;
    void reloadLog();
  }, [open, reloadLog]);

  useEffect(() => {
    if (!open) {
      didAutofocusStartTimeRef.current = false;
      return;
    }
    if (readOnly || didAutofocusStartTimeRef.current) return;
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        startTimeRef.current?.focus();
        didAutofocusStartTimeRef.current = true;
      });
    });
    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, [open, readOnly, entry?.id, defaultDay]);

  const save = useCallback(async () => {
    if (pending || readOnly) return;
    const starts_at = combineLocal(dateStr, startTime);
    const ends_at_input = combineLocal(dateStr, endTime);
    const startMs = new Date(starts_at).getTime();
    const endMs = new Date(ends_at_input).getTime();
    const closingOpenEntry =
      isOpenEntry && endMs <= Date.now() && endMs > startMs;
    const ends_at = isOpenEntry && !closingOpenEntry ? starts_at : ends_at_input;

    const timing = validateStaffWorkEntryTiming({
      entryType,
      startsAt: starts_at,
      endsAt: ends_at,
      entryId: entry?.id,
      isOpen: isOpenEntry && !closingOpenEntry,
      siblings: siblingEntries,
    });
    if (!timing.ok) {
      toast.error(timing.message);
      return;
    }

    const editingAbsence = entry != null && isShiftPlanAbsenceEntry(entry);
    const absenceType = absenceByDayKey?.get(dateStr);
    if (
      isStaffWorkTimeEntryType(entryType) &&
      absenceType != null &&
      !editingAbsence
    ) {
      toast.error(absenceBlocksWorkTimeMessage(absenceType));
      return;
    }

    const after = {
      entry_type: entryType,
      starts_at,
      ends_at,
      note: entry?.note ?? null,
    };

    setPending(true);
    const res = await upsertStaffWorkEntry(restaurantId, staffId, {
      id: entry?.id,
      ...after,
      ...(isOpenEntry ? { is_open: !closingOpenEntry } : {}),
    });
    setPending(false);
    if (!res) {
      toast.error("Speichern fehlgeschlagen.");
      return;
    }

    const changes = buildStaffWorkEntryChanges(entry, after);
    if (changes.length > 0 || !entry) {
      await insertStaffWorkEntryLogEntry(
        restaurantId,
        res.id,
        entry ? "updated" : "created",
        changes,
      );
    }

    toast.success("Gespeichert");
    onSaved();
    onOpenChange(false);
  }, [
    pending,
    readOnly,
    dateStr,
    startTime,
    endTime,
    restaurantId,
    staffId,
    entry,
    entryType,
    onSaved,
    onOpenChange,
    absenceByDayKey,
    siblingEntries,
    isOpenEntry,
  ]);

  const drawerTitle = entry
    ? readOnly
      ? "Arbeitszeit ansehen"
      : "Eintrag bearbeiten"
    : "Arbeitszeit / Abwesenheit";

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className={drawerContentClassName("formMd")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle>{drawerTitle}</DrawerTitle>
          </DrawerHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className={drawerScrollAreaClassName(6)}>
              <DrawerFormSection>
              {isOpenEntry ? (
                <p className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-foreground">
                  Läuft noch — Zeiten sind bearbeitbar. „Bis“ in der Vergangenheit
                  beendet den Eintrag.
                </p>
              ) : null}
              {isDisplayEntry ? (
                <p className="text-sm text-muted-foreground">
                  Display-Erfassung — Zeiten können hier nachträglich angepasst
                  werden.
                </p>
              ) : null}
              <div className="space-y-2">
                <Label>Art</Label>
                <Select
                  value={entryType}
                  items={STAFF_WORK_ENTRY_ITEMS}
                  disabled={readOnly}
                  onValueChange={(v) => {
                    if (typeof v === "string") {
                      setEntryType(v as StaffWorkEntryType);
                    }
                  }}
                >
                  <SelectTrigger
                    className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <StaffWorkEntryTypeStripe
                        type={entryType}
                        className="h-4 self-center"
                      />
                      <SelectValue placeholder="Art wählen">
                        {STAFF_WORK_ENTRY_LABELS[entryType]}
                      </SelectValue>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_WORK_ENTRY_TYPES.map((k) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <StaffWorkEntryTypeStripe
                            type={k}
                            className="h-4 self-center"
                          />
                          {STAFF_WORK_ENTRY_LABELS[k]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Datum</Label>
                <Input
                  type="date"
                  value={dateStr}
                  disabled={readOnly}
                  onChange={(e) => setDateStr(e.target.value)}
                  className={staffDrawerFieldClassName}
                />
              </div>
              <div className="flex gap-3">
                <div className="space-y-2">
                  <Label htmlFor="staff-work-start-time">Von</Label>
                  <input
                    ref={startTimeRef}
                    id="staff-work-start-time"
                    type="time"
                    value={startTime}
                    disabled={readOnly}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={formScheduleTimeInputClassName}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bis</Label>
                  <input
                    type="time"
                    value={endTime}
                    disabled={readOnly}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={formScheduleTimeInputClassName}
                  />
                </div>
              </div>
              </DrawerFormSection>

              {entry?.id ? (
                <DrawerFormSection title="Protokoll">
                  {logLoading ? (
                    <p className="text-sm text-muted-foreground">Wird geladen …</p>
                  ) : logEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Noch keine Einträge — Änderungen erscheinen nach dem
                      Speichern.
                    </p>
                  ) : (
                    <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border/40 bg-muted/15 p-3">
                      {logEntries.map((logEntry) => (
                        <li
                          key={logEntry.id}
                          className="border-b border-border/30 pb-2 text-sm last:border-0 last:pb-0"
                        >
                          <p className="font-medium">
                            {logEntry.action === "created"
                              ? "Angelegt"
                              : "Geändert"}
                            {" · "}
                            <span className="font-normal text-muted-foreground">
                              {logWhenFmt.format(new Date(logEntry.created_at))}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatStaffContractLogActorLabel(logEntry.details)}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed">
                            {formatStaffWorkEntryLogDisplaySummary({
                              action: logEntry.action,
                              details: logEntry.details,
                            })}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </DrawerFormSection>
              ) : null}
            </div>
            <DrawerFormFooter
              onCancel={() => onOpenChange(false)}
              cancelLabel={readOnly ? "Schließen" : "Abbrechen"}
              submitType="submit"
              submitPending={pending}
              showSubmit={!readOnly}
              showDelete={!!entry && !readOnly}
              onDelete={() => setConfirmDelete(true)}
              deleteLabel="Eintrag löschen"
            />
          </form>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eintrag löschen?"
        description="Dieser Eintrag wird dauerhaft entfernt."
        confirmLabel="Löschen"
        destructive
        onConfirm={async () => {
          if (!entry) return;
          await insertStaffWorkEntryLogEntry(
            restaurantId,
            entry.id,
            "updated",
            [],
            "Eintrag gelöscht",
          );
          await onDelete(entry.id);
          setConfirmDelete(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
