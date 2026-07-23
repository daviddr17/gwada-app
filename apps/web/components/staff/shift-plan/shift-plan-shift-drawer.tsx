"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
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
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
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
import { buildStaffSearchableSelectOptions } from "@/lib/staff/staff-select-options";
import { localDayKey, parseLocalDayKey } from "@/lib/staff/shift-schedule-range";
import { findOverlappingScheduledShift } from "@/lib/staff/shift-plan-overlap";

type ShiftPlanShiftDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  staffRows: RestaurantStaffRow[];
  templates: RestaurantShiftTemplateRow[];
  /** Bestehende Schichten im aktuellen Zeitraum — für Überschneidungsprüfung. */
  existingShifts: RestaurantStaffScheduledShiftRow[];
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
  existingShifts,
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

  useDrawerFormSeed(open, shift?.id ?? "__create__", () => {
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
  });

  const templatesRef = useRef(templates);
  templatesRef.current = templates;
  useEffect(() => {
    if (templateId === "none") return;
    const t = templatesRef.current.find((x) => x.id === templateId);
    if (!t) return;
    setStartTime(t.start_time.slice(0, 5));
    setEndTime(t.end_time.slice(0, 5));
  }, [templateId]);

  const staffSelectOptions = useMemo(
    () =>
      buildStaffSearchableSelectOptions(staffRows, {
        includeStaffIds: [staffId],
        showInactiveSuffix: false,
      }),
    [staffRows, staffId],
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

    if (
      findOverlappingScheduledShift(
        { startsAt, endsAt },
        existingShifts,
        {
          staffId,
          dayKey: dateYmd,
          excludeShiftId: shift?.id,
        },
      )
    ) {
      toast.error("Zu dieser Zeit gibt es bereits eine Schicht.");
      return;
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
    existingShifts,
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
        <DrawerContent className={drawerContentClassName("formMd")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
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
            <div className={drawerScrollAreaClassName(6)}>
              <DrawerFormSection title="Planung">
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
              </DrawerFormSection>

              <DrawerFormSection title="Notiz">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional"
                  className={staffDrawerFieldClassName}
                />
              </DrawerFormSection>
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
