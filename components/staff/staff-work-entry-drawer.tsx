"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { upsertStaffWorkEntry } from "@/lib/supabase/staff-db";
import {
  absenceBlocksWorkTimeMessage,
  isShiftPlanAbsenceEntry,
  isStaffWorkTimeEntryType,
  type ShiftPlanAbsenceEntryType,
} from "@/lib/staff/shift-plan-absence";
import type {
  RestaurantStaffWorkEntryRow,
  StaffWorkEntryType,
} from "@/lib/types/staff";
import {
  STAFF_WORK_ENTRY_ITEMS,
  STAFF_WORK_ENTRY_LABELS,
  STAFF_WORK_ENTRY_TYPES,
} from "@/lib/types/staff";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import { staffDrawerFieldClassName, staffDrawerScrollClassName } from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

type StaffWorkEntryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  staffId: string;
  entry: RestaurantStaffWorkEntryRow | null;
  defaultDay: Date | null;
  /** Urlaub/Krank pro Tag — dort keine Arbeitszeit/Pause anlegen. */
  absenceByDayKey?: ReadonlyMap<string, ShiftPlanAbsenceEntryType>;
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
  onSaved,
  onDelete,
}: StaffWorkEntryDrawerProps) {
  const [entryType, setEntryType] = useState<StaffWorkEntryType>("work");
  const [dateStr, setDateStr] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const startTimeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      const s = new Date(entry.starts_at);
      const e = new Date(entry.ends_at);
      setEntryType(entry.entry_type);
      setDateStr(toDateInput(s));
      setStartTime(toTimeInput(s));
      setEndTime(toTimeInput(e));
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
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        startTimeRef.current?.focus();
      });
    });
    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, [open, entry?.id, defaultDay, startTime]);

  const save = useCallback(async () => {
    if (pending) return;
    const starts_at = combineLocal(dateStr, startTime);
    const ends_at = combineLocal(dateStr, endTime);
    if (new Date(ends_at) <= new Date(starts_at)) {
      toast.error("Ende muss nach Beginn liegen.");
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

    setPending(true);
    const res = await upsertStaffWorkEntry(restaurantId, staffId, {
      id: entry?.id,
      entry_type: entryType,
      starts_at,
      ends_at,
      note: null,
    });
    setPending(false);
    if (!res) {
      toast.error("Speichern fehlgeschlagen.");
      return;
    }
    toast.success("Gespeichert");
    onSaved();
    onOpenChange(false);
  }, [
    pending,
    dateStr,
    startTime,
    endTime,
    restaurantId,
    staffId,
    entry?.id,
    entryType,
    onSaved,
    onOpenChange,
    absenceByDayKey,
  ]);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className="mx-auto flex max-h-[min(92dvh,560px)] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
          <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
            <DrawerTitle>
              {entry ? "Eintrag bearbeiten" : "Arbeitszeit / Abwesenheit"}
            </DrawerTitle>
          </DrawerHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className={cn(staffDrawerScrollClassName, "space-y-4 px-6 pb-4")}>
            <div className="space-y-2">
              <Label>Art</Label>
              <Select
                value={entryType}
                items={STAFF_WORK_ENTRY_ITEMS}
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
                  onChange={(e) => setStartTime(e.target.value)}
                  className={formScheduleTimeInputClassName}
                />
              </div>
              <div className="space-y-2">
                <Label>Bis</Label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={formScheduleTimeInputClassName}
                />
              </div>
            </div>
            </div>
            <DrawerFormFooter
              onCancel={() => onOpenChange(false)}
              submitType="submit"
              submitPending={pending}
              showDelete={!!entry}
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
          if (entry) await onDelete(entry.id);
          setConfirmDelete(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
