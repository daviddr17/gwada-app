"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
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
import { formScheduleTimeInputClassName } from "@/components/ui/date-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";
import {
  createScheduledShift,
  deleteScheduledShift,
  updateScheduledShift,
} from "@/lib/supabase/staff-shift-schedule-db";
import type {
  RestaurantShiftTemplateRow,
  RestaurantStaffScheduledShiftRow,
} from "@/lib/types/staff-shift-schedule";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { staffDisplayName } from "@/lib/types/staff";
import { localDayKey, parseLocalDayKey } from "@/lib/staff/shift-schedule-range";

type ShiftPlanShiftDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  staffRows: RestaurantStaffRow[];
  templates: RestaurantShiftTemplateRow[];
  shift: RestaurantStaffScheduledShiftRow | null;
  defaultStaffId: string | null;
  defaultDay: Date | null;
  requiresAcceptance: boolean;
  onSaved: () => void;
};

function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combineLocal(dateYmd: string, time: string): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

export function ShiftPlanShiftDrawer({
  open,
  onOpenChange,
  restaurantId,
  staffRows,
  templates,
  shift,
  defaultStaffId,
  defaultDay,
  requiresAcceptance,
  onSaved,
}: ShiftPlanShiftDrawerProps) {
  const isEdit = shift != null;
  const [staffId, setStaffId] = useState("");
  const [dateYmd, setDateYmd] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [templateId, setTemplateId] = useState<string>("none");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (shift) {
      setStaffId(shift.staff_id);
      setDateYmd(localDayKey(new Date(shift.starts_at)));
      setStartTime(toTimeInput(new Date(shift.starts_at)));
      setEndTime(toTimeInput(new Date(shift.ends_at)));
      setTemplateId(shift.template_id ?? "none");
      setLabel(shift.label ?? "");
      setNote(shift.note ?? "");
      return;
    }
    setStaffId(defaultStaffId ?? staffRows[0]?.id ?? "");
    setDateYmd(defaultDay ? localDayKey(defaultDay) : localDayKey(new Date()));
    setStartTime("09:00");
    setEndTime("17:00");
    setTemplateId("none");
    setLabel("");
    setNote("");
  }, [open, shift, defaultStaffId, defaultDay, staffRows]);

  useEffect(() => {
    if (templateId === "none") return;
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setStartTime(t.start_time.slice(0, 5));
    setEndTime(t.end_time.slice(0, 5));
  }, [templateId, templates]);

  const staffSelectOptions = useMemo(
    () =>
      staffRows.map((s) => ({
        value: s.id,
        label: staffDisplayName(s),
        leadingColor: s.position_tag?.background_color,
      })),
    [staffRows],
  );

  const selectedTemplateLabel = useMemo(() => {
    if (templateId === "none") return "Keine Vorlage";
    return templates.find((t) => t.id === templateId)?.name ?? "Keine Vorlage";
  }, [templateId, templates]);

  const save = useCallback(async () => {
    if (!staffId || !dateYmd) {
      toast.error("Mitarbeiter und Datum sind erforderlich.");
      return;
    }
    const startsAt = combineLocal(dateYmd, startTime);
    let endsAt = combineLocal(dateYmd, endTime);
    if (new Date(endsAt) <= new Date(startsAt)) {
      const endDate = parseLocalDayKey(dateYmd);
      endDate.setDate(endDate.getDate() + 1);
      endsAt = combineLocal(localDayKey(endDate), endTime);
    }

    setPending(true);
    if (isEdit && shift) {
      const { error } = await updateScheduledShift({
        id: shift.id,
        staffId,
        startsAt,
        endsAt,
        templateId: templateId === "none" ? null : templateId,
        label: label.trim() || null,
        note: note.trim() || null,
      });
      setPending(false);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Schicht gespeichert.");
    } else {
      const { error } = await createScheduledShift({
        restaurantId,
        staffId,
        startsAt,
        endsAt,
        templateId: templateId === "none" ? null : templateId,
        label: label.trim() || null,
        note: note.trim() || null,
        status: requiresAcceptance ? "pending" : "confirmed",
      });
      setPending(false);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(
        requiresAcceptance
          ? "Schicht geplant — Bestätigung angefordert."
          : "Schicht geplant.",
      );
    }
    onSaved();
    onOpenChange(false);
  }, [
    staffId,
    dateYmd,
    startTime,
    endTime,
    templateId,
    label,
    note,
    isEdit,
    shift,
    restaurantId,
    requiresAcceptance,
    onSaved,
    onOpenChange,
  ]);

  const remove = useCallback(async () => {
    if (!shift) return;
    setPending(true);
    const { error } = await deleteScheduledShift(shift.id);
    setPending(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Schicht gelöscht.");
    onSaved();
    onOpenChange(false);
  }, [shift, onSaved, onOpenChange]);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent className="mx-auto flex max-h-[min(92dvh,640px)] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
          <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              {isEdit ? "Schicht bearbeiten" : "Schicht planen"}
            </DrawerTitle>
            <DrawerDescription className="text-base">
              Mitarbeiter, Datum und Uhrzeiten für den Dienstplan.
            </DrawerDescription>
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
                <Label>Mitarbeiter</Label>
                <SearchableSelect
                  options={staffSelectOptions}
                  value={staffId || null}
                  onValueChange={setStaffId}
                  placeholder="Auswählen"
                  searchPlaceholder="Mitarbeiter suchen…"
                  aria-label="Mitarbeiter"
                  className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
                />
              </div>

              <div className="space-y-2">
                <Label>Datum</Label>
                <Input
                  type="date"
                  value={dateYmd}
                  onChange={(e) => setDateYmd(e.target.value)}
                  className={staffDrawerFieldClassName}
                />
              </div>

              <div className="space-y-2">
                <Label>Vorlage</Label>
                <Select value={templateId} onValueChange={(v) => setTemplateId(String(v))}>
                  <SelectTrigger className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}>
                    <SelectValue placeholder="Optional">
                      {selectedTemplateLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Vorlage</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Bezeichnung</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Leer = Schicht"
                  className={staffDrawerFieldClassName}
                />
              </div>

              <div className="flex gap-3">
                <div className="space-y-2">
                  <Label htmlFor="shift-plan-start">Beginn</Label>
                  <input
                    id="shift-plan-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={formScheduleTimeInputClassName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shift-plan-end">Ende</Label>
                  <input
                    id="shift-plan-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={formScheduleTimeInputClassName}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notiz</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional"
                  className={staffDrawerFieldClassName}
                />
              </div>
            </div>

            <DrawerFormFooter
              onCancel={() => onOpenChange(false)}
              submitType="submit"
              submitPending={pending}
              showDelete={isEdit}
              onDelete={() => setConfirmDelete(true)}
              deleteLabel="Schicht löschen"
            />
          </form>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Schicht löschen?"
        description="Die geplante Schicht wird dauerhaft entfernt."
        confirmLabel="Löschen"
        destructive
        onConfirm={() => void remove()}
      />
    </>
  );
}
