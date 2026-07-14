"use client";

import { useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { formScheduleTimeInputClassName } from "@/components/ui/date-picker";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { MENU_TAXONOMY_COLOR_INPUT_CLASSNAME } from "@/lib/constants/menu-color-picker";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import { cn } from "@/lib/utils";
import type { RestaurantShiftTemplateRow } from "@/lib/types/staff-shift-schedule";
import {
  deleteShiftTemplate,
  upsertShiftTemplate,
} from "@/lib/supabase/staff-shift-schedule-db";

const HEX = /^#[0-9A-Fa-f]{6}$/;

type ShiftPlanTemplateDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  restaurantId: string;
  template: RestaurantShiftTemplateRow | null;
  nextSortOrder: number;
  onSaved: () => void;
};

export function ShiftPlanTemplateDrawer({
  open,
  onOpenChange,
  mode,
  restaurantId,
  template,
  nextSortOrder,
  onSaved,
}: ShiftPlanTemplateDrawerProps) {
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [color, setColor] = useState("#3b82f6");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useDrawerFormSeed(open, `${mode}:${template?.id ?? "__create__"}`, () => {
    if (mode === "edit" && template) {
      setName(template.name);
      setStartTime(template.start_time.slice(0, 5));
      setEndTime(template.end_time.slice(0, 5));
      setColor(HEX.test(template.color) ? template.color : "#3b82f6");
      return;
    }
    setName("");
    setStartTime("09:00");
    setEndTime("17:00");
    setColor("#3b82f6");
  });

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name ist erforderlich.");
      return;
    }
    const normalizedColor = HEX.test(color) ? color : "#3b82f6";
    setPending(true);
    const base = {
      restaurant_id: restaurantId,
      name: trimmed,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      color: normalizedColor,
      sort_order: template?.sort_order ?? nextSortOrder,
      is_active: true as const,
    };
    const { error } =
      mode === "edit" && template
        ? await upsertShiftTemplate({ ...base, id: template.id })
        : await upsertShiftTemplate(base);
    setPending(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(mode === "edit" ? "Vorlage gespeichert." : "Vorlage angelegt.");
    onSaved();
    onOpenChange(false);
  };

  const remove = async () => {
    if (!template) return;
    setPending(true);
    const { error } = await deleteShiftTemplate(template.id);
    setPending(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Vorlage entfernt.");
    onSaved();
    onOpenChange(false);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent className={drawerContentClassName("template")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              {mode === "edit" ? "Vorlage bearbeiten" : "Neue Vorlage"}
            </DrawerTitle>
            <DrawerDescription className="text-base">
              Name, Uhrzeiten und Farbe für Drag & Drop in den Schichtplan.
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
              <DrawerFormSection title="Vorlage">
              <div className="space-y-2">
                <Label htmlFor="shift-template-name">Name</Label>
                <Input
                  id="shift-template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Spätschicht"
                  className={staffDrawerFieldClassName}
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <div className="space-y-2">
                  <Label htmlFor="shift-template-start">Beginn</Label>
                  <input
                    id="shift-template-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={formScheduleTimeInputClassName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shift-template-end">Ende</Label>
                  <input
                    id="shift-template-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={formScheduleTimeInputClassName}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shift-template-color">Farbe</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="shift-template-color"
                    type="color"
                    value={HEX.test(color) ? color : "#3b82f6"}
                    onChange={(e) => setColor(e.target.value)}
                    className={MENU_TAXONOMY_COLOR_INPUT_CLASSNAME}
                    aria-label="Farbe wählen"
                  />
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#3b82f6"
                    className={cn(staffDrawerFieldClassName, "font-mono text-sm")}
                    spellCheck={false}
                    maxLength={7}
                  />
                </div>
              </div>
              </DrawerFormSection>
            </div>

            <DrawerFormFooter
              onCancel={() => onOpenChange(false)}
              submitType="submit"
              submitPending={pending}
              submitLabel={mode === "edit" ? "Speichern" : "Anlegen"}
              showDelete={mode === "edit" && template != null}
              onDelete={() => setConfirmDelete(true)}
              deleteLabel="Vorlage löschen"
            />
          </form>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Vorlage löschen?"
        description="Die Vorlage verschwindet aus der Palette. Bereits geplante Schichten bleiben erhalten."
        confirmLabel="Löschen"
        destructive
        onConfirm={() => void remove()}
      />
    </>
  );
}
