"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { staffDrawerScrollClassName } from "@/components/staff/staff-form-field-styles";
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchableSelect } from "@/components/ui/combobox";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import type { ChecklistAreaDefinition } from "@/lib/types/checklist-areas-devices";
import type { RestaurantChecklistDeviceRow } from "@/lib/types/checklist-areas-devices";
import type { ChecklistDeviceUpsertInput } from "@/lib/types/checklist-areas-devices";

const selectClass = appSelectTriggerAccentCn(staffDrawerFieldClassName);

type ChecklistDeviceFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: RestaurantChecklistDeviceRow | null;
  areas: ChecklistAreaDefinition[];
  onSave: (
    input: ChecklistDeviceUpsertInput,
    deviceId?: string | null,
  ) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
};

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function ChecklistDeviceFormDrawer({
  open,
  onOpenChange,
  device,
  areas,
  onSave,
  onDelete,
}: ChecklistDeviceFormDrawerProps) {
  const isEdit = device != null;
  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState<string>("");
  const [targetMin, setTargetMin] = useState("");
  const [targetMax, setTargetMax] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (device) {
      setName(device.name);
      setAreaId(device.area_id ?? "");
      setTargetMin(device.target_min != null ? String(device.target_min) : "");
      setTargetMax(device.target_max != null ? String(device.target_max) : "");
    } else {
      setName("");
      setAreaId("");
      setTargetMin("");
      setTargetMax("");
    }
  }, [open, device]);

  const areaOptions = [
    { value: "", label: "Kein Bereich" },
    ...areas
      .filter((a) => a.active)
      .map((a) => ({ value: a.id, label: a.name })),
  ];

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name ist erforderlich.");
      return;
    }
    setSaving(true);
    const ok = await onSave(
      {
        name: trimmed,
        areaId: areaId || null,
        targetMin: parseOptionalNumber(targetMin),
        targetMax: parseOptionalNumber(targetMax),
      },
      device?.id ?? null,
    );
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!device || !onDelete) return;
    setSaving(true);
    const ok = await onDelete(device.id);
    setSaving(false);
    if (ok) {
      setConfirmDelete(false);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={drawerContentClassName("formStaff")}>
          <DrawerHeader>
            <DrawerTitle>{isEdit ? "Gerät bearbeiten" : "Neues Gerät"}</DrawerTitle>
            <DrawerDescription>
              Kühlschrank, Truhe oder Thermometer — optional mit Bereich und
              Soll-Temperatur für verknüpfte Aufgaben.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFormBody>
            <div className={staffDrawerScrollClassName}>
              <DrawerFormSection title="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Kühlschrank Küche"
                  className={staffDrawerFieldClassName}
                />
              </DrawerFormSection>
              <DrawerFormSection title="Bereich">
                <SearchableSelect
                  value={areaId}
                  onValueChange={setAreaId}
                  options={areaOptions}
                  className={selectClass}
                />
              </DrawerFormSection>
              <DrawerFormSection title="Soll-Temperatur (optional)">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">Min. °C</span>
                    <Input
                      inputMode="decimal"
                      value={targetMin}
                      onChange={(e) => setTargetMin(e.target.value)}
                      placeholder="z. B. -18"
                      className={staffDrawerFieldClassName}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">Max. °C</span>
                    <Input
                      inputMode="decimal"
                      value={targetMax}
                      onChange={(e) => setTargetMax(e.target.value)}
                      placeholder="z. B. 7"
                      className={staffDrawerFieldClassName}
                    />
                  </div>
                </div>
              </DrawerFormSection>
            </div>
            <DrawerFormFooter
              submitPending={saving}
              submitType="button"
              onSubmit={() => void handleSave()}
              onCancel={() => onOpenChange(false)}
              showDelete={isEdit && !!onDelete}
              deleteLabel="Löschen"
              onDelete={() => setConfirmDelete(true)}
              deleteDisabled={saving}
            />
          </DrawerFormBody>
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Gerät löschen?"
        description="Verknüpfte Aufgaben behalten den Namen, verlieren aber die Geräte-Verknüpfung."
        confirmLabel="Löschen"
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
