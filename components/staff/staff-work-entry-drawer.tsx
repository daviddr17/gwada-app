"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { upsertStaffWorkEntry } from "@/lib/supabase/staff-db";
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
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type StaffWorkEntryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  staffId: string;
  entry: RestaurantStaffWorkEntryRow | null;
  defaultDay: Date | null;
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
  ]);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className="mx-auto max-w-lg overflow-hidden rounded-t-[1.75rem] border-0 bg-card px-5 pb-6">
          <DrawerHeader>
            <DrawerTitle>
              {entry ? "Eintrag bearbeiten" : "Arbeitszeit / Abwesenheit"}
            </DrawerTitle>
          </DrawerHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
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
            <Button
              type="submit"
              className="w-full rounded-xl"
              disabled={pending}
            >
              {pending ? "Speichern …" : "Speichern"}
            </Button>
            {entry ? (
              <Button
                type="button"
                variant="destructive"
                className="w-full rounded-xl"
                onClick={() => setConfirmDelete(true)}
              >
                Löschen
              </Button>
            ) : null}
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
