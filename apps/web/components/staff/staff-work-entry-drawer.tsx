"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
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
import { Checkbox } from "@/components/ui/checkbox";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  fetchStaffWorkEntryLogEntries,
  upsertStaffWorkEntry,
  deleteStaffWorkEntry,
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
import { isDisplayWorkEntry, displayShiftBounds } from "@/lib/staff/staff-work-hours-display";
import { listOtherShiftClusterWorkSegments } from "@/lib/staff/staff-work-shift-cluster";
import { validateStaffWorkEntryTiming, listSubsumedShiftWorkSegments } from "@/lib/staff/staff-work-entry-validation";
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
import { useDrawerFormKeyboardAssist } from "@/lib/hooks/use-drawer-form-keyboard-assist";
import { cn } from "@/lib/utils";
import { fetchStaffModuleSettings } from "@/lib/supabase/staff-module-settings-db";
import { applyLaborComplianceAutoFixForStaffDay } from "@/lib/staff/labor-law/apply-labor-compliance-fix";

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
  /** Alle Segmente beim Bearbeiten einer Schicht mit Pause (Display/Legacy). */
  shiftClusterSegments?: readonly RestaurantStaffWorkEntryRow[];
  onSaved: (dayYmd?: string) => void;
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
  shiftClusterSegments = [],
  onSaved,
  onDelete,
}: StaffWorkEntryDrawerProps) {
  const [entryType, setEntryType] = useState<StaffWorkEntryType>("work");
  const [dateStr, setDateStr] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [stillRunning, setStillRunning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [logEntries, setLogEntries] = useState<RestaurantStaffWorkEntryLogEntry[]>(
    [],
  );
  const [logLoading, setLogLoading] = useState(false);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const didAutofocusStartTimeRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { repositionInputs } = useDrawerFormKeyboardAssist({ open, scrollRef });

  const readOnly = !allowEdit;
  const isOpenEntry = Boolean(entry?.is_open);
  const isDisplayEntry = entry != null && isDisplayWorkEntry(entry);
  const editingShiftCluster = shiftClusterSegments.length > 0;
  const clusterOpen = shiftClusterSegments.some((s) => s.is_open);
  const clusterStartOnlyEdit =
    editingShiftCluster &&
    clusterOpen &&
    entry?.entry_type === "work" &&
    !isOpenEntry;

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

  useDrawerFormSeed(
    open,
    `${entry?.id ?? "__create__"}:${shiftClusterSegments.map((s) => s.id).join(",")}`,
    () => {
    if (entry) {
      const bounds = editingShiftCluster
        ? displayShiftBounds([...shiftClusterSegments])
        : null;
      const startDate = bounds
        ? new Date(bounds.startsAt)
        : new Date(entry.starts_at);
      setEntryType(entry.entry_type);
      setDateStr(toDateInput(startDate));
      setStartTime(toTimeInput(startDate));
      const openWork = Boolean(
        (bounds?.isOpen ?? false) ||
          (entry.is_open && entry.entry_type === "work"),
      );
      setStillRunning(openWork);
      setEndTime(
        openWork
          ? toTimeInput(new Date())
          : toTimeInput(
              new Date(bounds?.endsAt ?? entry.ends_at),
            ),
      );
      return;
    }
    const day = defaultDay ?? new Date();
    setEntryType("work");
    setDateStr(toDateInput(day));
    setStartTime("09:00");
    setEndTime("17:00");
    setStillRunning(false);
  });

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
    const willStayOpen = entryType === "work" && stillRunning && !clusterStartOnlyEdit;
    const ends_at = willStayOpen ? starts_at : ends_at_input;

    const finishUi = (entryId: string, after: {
      entry_type: StaffWorkEntryType;
      starts_at: string;
      ends_at: string;
      note: string | null;
    }, opts?: { runAutoFix?: boolean }) => {
      setPending(false);
      toast.success("Gespeichert");
      onOpenChange(false);
      onSaved(dateStr);

      const runAutoFix = opts?.runAutoFix === true;
      void (async () => {
        try {
          const changes = buildStaffWorkEntryChanges(entry, after);
          if (changes.length > 0 || !entry) {
            await insertStaffWorkEntryLogEntry(
              restaurantId,
              entryId,
              entry ? "updated" : "created",
              changes,
            );
          }
          if (!runAutoFix) return;
          const { data: settings } = await fetchStaffModuleSettings(restaurantId);
          if (!settings?.labor_auto_fix_missing_breaks) return;
          const fixResult = await applyLaborComplianceAutoFixForStaffDay({
            restaurantId,
            staffId,
            dayYmd: dateStr,
          });
          if (fixResult.error) {
            toast.error(fixResult.error);
            return;
          }
          if (fixResult.fixed) {
            toast.success("Fehlende Mindestpause automatisch eingetragen");
            onSaved(dateStr);
          }
        } catch {
          // UI already closed — log/autofix failures must not reopen the sheet.
        }
      })();
    };

    if (clusterStartOnlyEdit && entry) {
      const timing = validateStaffWorkEntryTiming({
        entryType: entry.entry_type,
        startsAt: starts_at,
        endsAt: entry.ends_at,
        staffId,
        entryId: entry.id,
        siblings: siblingEntries,
      });
      if (!timing.ok) {
        toast.error(timing.message);
        return;
      }

      const after = {
        entry_type: entry.entry_type,
        starts_at,
        ends_at: entry.ends_at,
        note: entry.note ?? null,
      };
      setPending(true);
      const res = await upsertStaffWorkEntry(restaurantId, staffId, {
        id: entry.id,
        ...after,
      });
      if (!res) {
        setPending(false);
        toast.error("Speichern fehlgeschlagen.");
        return;
      }
      finishUi(res.id, after);
      return;
    }

    const timing = validateStaffWorkEntryTiming({
      entryType,
      startsAt: starts_at,
      endsAt: ends_at,
      staffId,
      entryId: entry?.id,
      isOpen: willStayOpen,
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
    const openShiftId =
      willStayOpen && entry?.shift_id
        ? entry.shift_id
        : willStayOpen
          ? crypto.randomUUID()
          : undefined;
    const res = await upsertStaffWorkEntry(restaurantId, staffId, {
      id: entry?.id,
      ...after,
      ...(willStayOpen
        ? { is_open: true, shift_id: openShiftId ?? null }
        : entry?.is_open
          ? { is_open: false }
          : {}),
    });
    if (!res) {
      setPending(false);
      toast.error("Speichern fehlgeschlagen.");
      return;
    }

    if (
      entryType === "work" &&
      !willStayOpen &&
      entry &&
      siblingEntries.length > 0
    ) {
      if (editingShiftCluster) {
        const others = listOtherShiftClusterWorkSegments(entry, siblingEntries);
        for (const sub of others) {
          await deleteStaffWorkEntry(sub.id);
        }
      } else {
        const subsumed = listSubsumedShiftWorkSegments({
          startsAt: starts_at,
          endsAt: ends_at,
          entryId: entry.id,
          anchorEntry: entry,
          siblings: siblingEntries,
        });
        for (const sub of subsumed) {
          await deleteStaffWorkEntry(sub.id);
        }
      }
    }

    finishUi(res.id, after, {
      runAutoFix: entryType === "work" && !willStayOpen,
    });
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
    stillRunning,
    editingShiftCluster,
    clusterStartOnlyEdit,
  ]);

  const drawerTitle = entry
    ? readOnly
      ? "Arbeitszeit ansehen"
      : "Eintrag bearbeiten"
    : "Arbeitszeit / Abwesenheit";

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={repositionInputs}>
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
            <div ref={scrollRef} className={drawerScrollAreaClassName(6)}>
              <DrawerFormSection>
              {stillRunning ? (
                <p className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-foreground">
                  {clusterStartOnlyEdit
                    ? "Schicht läuft noch nach der Pause — nur Start und Datum sind bearbeitbar."
                    : "Ende offen — Start und Datum sind bearbeitbar. Zum Beenden Haken entfernen und „Bis“ setzen (oder am Display ausstempeln)."}
                </p>
              ) : null}
              {editingShiftCluster && !clusterOpen && entryType === "work" ? (
                <p className="text-sm text-muted-foreground">
                  Schicht mit Pause — Von/Bis setzt die Gesamt-Arbeitszeit; Pausen
                  bleiben erhalten.
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
                      const next = v as StaffWorkEntryType;
                      setEntryType(next);
                      if (next !== "work") {
                        setStillRunning(false);
                      }
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
                    disabled={readOnly || stillRunning}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={formScheduleTimeInputClassName}
                  />
                </div>
              </div>
              {entryType === "work" &&
              !readOnly &&
              (!entry || isOpenEntry || clusterOpen) ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/50 p-3">
                  <Checkbox
                    checked={stillRunning}
                    onCheckedChange={(v) => {
                      const next = v === true;
                      setStillRunning(next);
                      if (!next && !endTime) {
                        setEndTime(toTimeInput(new Date()));
                      }
                    }}
                    disabled={pending || clusterStartOnlyEdit}
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-snug">
                    Läuft noch — Ende offen lassen (Mitarbeiter stempelt später
                    am Display aus)
                  </span>
                </label>
              ) : null}
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
