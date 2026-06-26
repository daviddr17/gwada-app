"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DatePickerField,
  formScheduleTimeInputClassName,
} from "@/components/ui/date-picker";
import {
  staffDrawerFieldClassName,
} from "@/components/staff/staff-form-field-styles";
import {
  datetimeLocalValueToIso,
  datetimeLocalValueToYmdHm,
  isoToDatetimeLocalValue,
  ymdAndHmToDatetimeLocal,
} from "@/lib/reservations/datetime-local";
import {
  DrawerFormBody,
  DrawerFormSection,
  DrawerFormScrollArea,
} from "@/components/ui/drawer-form-section";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  archiveComplianceChecklist,
  upsertComplianceChecklist,
} from "@/lib/supabase/compliance-db";
import {
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_CATEGORY_LABELS,
  COMPLIANCE_FIELD_TYPE_LABELS,
  COMPLIANCE_FIELD_TYPES,
  COMPLIANCE_FREQUENCIES,
  COMPLIANCE_FREQUENCY_LABELS,
  COMPLIANCE_PRIORITY_LABELS,
  type ComplianceCategory,
  type ComplianceChecklistItem,
  type ComplianceFieldType,
  type ComplianceFrequency,
  type CompliancePriority,
  type RestaurantComplianceChecklistRow,
} from "@/lib/types/compliance";
import type { RestaurantComplianceDeviceRow } from "@/lib/types/compliance";
import type { RestaurantStaffRow, StaffPositionTagDefinition } from "@/lib/types/staff";
import { staffDisplayName } from "@/lib/types/staff";
import { newComplianceItemId } from "@/lib/compliance/compliance-utils";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { MultiSelectCheckboxList } from "@/components/ui/multi-select-checkbox-list";
import { assignedStaffIds, assignedPositionTagIds } from "@/lib/staff/assignee-matching";
import { hasModuleDelete } from "@/lib/permissions/module-crud-permissions";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { cn } from "@/lib/utils";

const selectClass = appSelectTriggerAccentCn("h-11 w-full rounded-xl");
const drawerTwoColClass = "grid gap-3 sm:grid-cols-2";

function isoToYmdHm(iso: string | null | undefined): { ymd: string; hm: string } {
  if (!iso) return { ymd: "", hm: "" };
  return datetimeLocalValueToYmdHm(isoToDatetimeLocalValue(iso));
}

function ymdHmToIso(ymd: string, hm: string): string | null {
  if (!ymd.trim()) return null;
  return datetimeLocalValueToIso(ymdAndHmToDatetimeLocal(ymd, hm || "00:00"));
}

type ComplianceChecklistFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  checklist: RestaurantComplianceChecklistRow | null;
  devices: readonly RestaurantComplianceDeviceRow[];
  staffList: readonly RestaurantStaffRow[];
  positionTags: readonly StaffPositionTagDefinition[];
  onSaved: () => void;
};

function emptyItem(category: ComplianceCategory): ComplianceChecklistItem {
  if (category === "temperature") {
    return {
      id: newComplianceItemId(),
      label: "Temperatur",
      fieldType: "temperature",
      maxValue: 7,
      required: true,
    };
  }
  if (category === "cleaning") {
    return {
      id: newComplianceItemId(),
      label: "Aufgabe erledigt",
      fieldType: "boolean",
      required: true,
    };
  }
  if (category === "goods_receipt") {
    return {
      id: newComplianceItemId(),
      label: "In Ordnung",
      fieldType: "select",
      options: ["OK", "Nicht OK"],
      required: true,
    };
  }
  return {
    id: newComplianceItemId(),
    label: "Wert",
    fieldType: "text",
    required: true,
  };
}

export function ComplianceChecklistFormDrawer({
  open,
  onOpenChange,
  restaurantId,
  checklist,
  devices,
  staffList,
  positionTags,
  onSaved,
}: ComplianceChecklistFormDrawerProps) {
  const { has } = useRestaurantPermissions();
  const canDelete = hasModuleDelete(has, "compliance");
  const isEdit = checklist != null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ComplianceCategory>("temperature");
  const [frequency, setFrequency] = useState<ComplianceFrequency>("daily");
  const [items, setItems] = useState<ComplianceChecklistItem[]>([]);
  const [showOnDisplay, setShowOnDisplay] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [positionTagIds, setPositionTagIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<CompliancePriority>("medium");
  const [displayFromYmd, setDisplayFromYmd] = useState("");
  const [displayFromHm, setDisplayFromHm] = useState("");
  const [displayUntilYmd, setDisplayUntilYmd] = useState("");
  const [displayUntilHm, setDisplayUntilHm] = useState("");
  const [showBeforeClockIn, setShowBeforeClockIn] = useState(false);
  const [showBeforeBreakStart, setShowBeforeBreakStart] = useState(false);
  const [showBeforeBreakEnd, setShowBeforeBreakEnd] = useState(false);
  const [showBeforeClockOut, setShowBeforeClockOut] = useState(false);
  const [showOnPinLogin, setShowOnPinLogin] = useState(false);
  const [requireDeferReason, setRequireDeferReason] = useState(false);
  const [blocksShiftEnd, setBlocksShiftEnd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const staffOptions = useMemo(
    () =>
      staffList
        .filter((s) => s.is_active)
        .map((s) => ({ value: s.id, label: staffDisplayName(s) })),
    [staffList],
  );

  const tagOptions = useMemo(
    () =>
      positionTags
        .filter((t) => t.active)
        .map((t) => ({ value: t.id, label: t.name })),
    [positionTags],
  );

  const resetAssigneeDefaults = () => {
    setStaffIds([]);
    setPositionTagIds([]);
    setPriority("medium");
    setDisplayFromYmd("");
    setDisplayFromHm("");
    setDisplayUntilYmd("");
    setDisplayUntilHm("");
    setShowBeforeClockIn(false);
    setShowBeforeBreakStart(false);
    setShowBeforeBreakEnd(false);
    setShowBeforeClockOut(false);
    setShowOnPinLogin(false);
    setRequireDeferReason(false);
    setBlocksShiftEnd(false);
  };

  useEffect(() => {
    if (!open) return;
    if (!checklist) {
      setName("");
      setDescription("");
      setCategory("temperature");
      setFrequency("daily");
      setItems([emptyItem("temperature")]);
      setShowOnDisplay(true);
      setIsActive(true);
      resetAssigneeDefaults();
      return;
    }
    setName(checklist.name);
    setDescription(checklist.description ?? "");
    setCategory(checklist.category);
    setFrequency(checklist.frequency);
    setItems(checklist.items.length > 0 ? checklist.items : [emptyItem(checklist.category)]);
    setShowOnDisplay(checklist.show_on_display);
    setIsActive(checklist.is_active);
    setStaffIds(assignedStaffIds(checklist));
    setPositionTagIds(assignedPositionTagIds(checklist));
    setPriority(checklist.priority ?? "medium");
    const from = isoToYmdHm(checklist.display_from);
    const until = isoToYmdHm(checklist.display_until);
    setDisplayFromYmd(from.ymd);
    setDisplayFromHm(from.hm);
    setDisplayUntilYmd(until.ymd);
    setDisplayUntilHm(until.hm);
    setShowBeforeClockIn(checklist.show_before_clock_in ?? false);
    setShowBeforeBreakStart(checklist.show_before_break_start ?? false);
    setShowBeforeBreakEnd(checklist.show_before_break_end ?? false);
    setShowBeforeClockOut(checklist.show_before_clock_out ?? false);
    setShowOnPinLogin(checklist.show_on_pin_login ?? false);
    setRequireDeferReason(checklist.require_defer_reason ?? false);
    setBlocksShiftEnd(checklist.blocks_shift_end ?? false);
  }, [open, checklist, staffList, positionTags]);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Bitte einen Namen angeben.");
      return;
    }
    if (items.length === 0) {
      toast.error("Mindestens ein Feld erforderlich.");
      return;
    }
    setSaving(true);
    const hasTrigger =
      showOnPinLogin ||
      showBeforeClockIn ||
      showBeforeBreakStart ||
      showBeforeBreakEnd ||
      showBeforeClockOut;
    const { error } = await upsertComplianceChecklist(
      restaurantId,
      {
        name,
        description,
        category,
        frequency,
        items,
        showOnDisplay: showOnDisplay || hasTrigger,
        isActive,
        staffIds,
        positionTagIds,
        priority,
        displayFrom: ymdHmToIso(displayFromYmd, displayFromHm),
        displayUntil: ymdHmToIso(displayUntilYmd, displayUntilHm),
        showBeforeClockIn,
        showBeforeBreakStart,
        showBeforeBreakEnd,
        showBeforeClockOut,
        showOnPinLogin,
        requireDeferReason,
        blocksShiftEnd,
      },
      checklist?.id,
    );
    setSaving(false);
    if (error) toast.error(error);
    else {
      toast.success(isEdit ? "Vorlage gespeichert." : "Vorlage angelegt.");
      onSaved();
      onOpenChange(false);
    }
  };

  const archive = async () => {
    if (!checklist) return;
    const { error } = await archiveComplianceChecklist(restaurantId, checklist.id);
    if (error) toast.error(error);
    else {
      toast.success("Vorlage archiviert.");
      onSaved();
      onOpenChange(false);
    }
  };

  const updateItem = (id: string, patch: Partial<ComplianceChecklistItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={drawerContentClassName("formStaff")}>
          <DrawerHeader>
            <DrawerTitle>
              {isEdit ? "Vorlage bearbeiten" : "Neue Vorlage"}
            </DrawerTitle>
            <DrawerDescription>
              Checkliste für Eigenkontrolle — Felder, Kategorie und Häufigkeit.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFormBody>
            <DrawerFormScrollArea>
            <DrawerFormSection title="Allgemein">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z. B. Kühl- & Tiefkühltemperaturen"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Beschreibung</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Bereich</Label>
                    <SearchableSelect
                      value={category}
                      onValueChange={(v) => {
                        const next = v as ComplianceCategory;
                        setCategory(next);
                        if (!isEdit && items.length === 1) {
                          setItems([emptyItem(next)]);
                        }
                      }}
                      options={COMPLIANCE_CATEGORIES.map((c) => ({
                        value: c,
                        label: COMPLIANCE_CATEGORY_LABELS[c],
                      }))}
                      className={selectClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Häufigkeit</Label>
                    <SearchableSelect
                      value={frequency}
                      onValueChange={(v) => setFrequency(v as ComplianceFrequency)}
                      options={COMPLIANCE_FREQUENCIES.map((f) => ({
                        value: f,
                        label: COMPLIANCE_FREQUENCY_LABELS[f],
                      }))}
                      className={selectClass}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
                  <div>
                    <p className="text-sm font-medium">Am Display erfassbar</p>
                    <p className="text-xs text-muted-foreground">
                      Kurzerfassung direkt an der Kühltruhe.
                    </p>
                  </div>
                  <Switch
                    checked={showOnDisplay}
                    onCheckedChange={setShowOnDisplay}
                  />
                </div>
                {isEdit ? (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
                    <div>
                      <p className="text-sm font-medium">Aktiv</p>
                      <p className="text-xs text-muted-foreground">
                        Inaktive Vorlagen erscheinen nicht zur Erfassung.
                      </p>
                    </div>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                ) : null}
              </div>
            </DrawerFormSection>

            <DrawerFormSection title="Zuweisung & Display">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Ohne Auswahl gilt die Vorlage für alle Mitarbeiter. Mehrfachauswahl
                  bei Personen und Positionen möglich.
                </p>
                <div className="space-y-2">
                  <Label>Mitarbeiter</Label>
                  <MultiSelectCheckboxList
                    options={staffOptions}
                    value={staffIds}
                    onChange={setStaffIds}
                    emptyMessage="Keine aktiven Mitarbeiter."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Positionen</Label>
                  <MultiSelectCheckboxList
                    options={tagOptions}
                    value={positionTagIds}
                    onChange={setPositionTagIds}
                    emptyMessage="Keine aktiven Positionen."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priorität</Label>
                  <SearchableSelect
                    value={priority}
                    onValueChange={(v) => setPriority(v as CompliancePriority)}
                    options={(
                      Object.entries(COMPLIANCE_PRIORITY_LABELS) as [
                        CompliancePriority,
                        string,
                      ][]
                    ).map(([value, label]) => ({ value, label }))}
                    className={selectClass}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">Sichtbar ab (Datum)</span>
                    <DatePickerField
                      fullWidth
                      value={displayFromYmd || null}
                      onChange={(d) => setDisplayFromYmd(d ?? "")}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">Uhrzeit</span>
                    <Input
                      type="time"
                      value={displayFromHm}
                      onChange={(e) => setDisplayFromHm(e.target.value)}
                      disabled={!displayFromYmd}
                      className={cn(staffDrawerFieldClassName, formScheduleTimeInputClassName)}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">Sichtbar bis (Datum)</span>
                    <DatePickerField
                      fullWidth
                      value={displayUntilYmd || null}
                      onChange={(d) => setDisplayUntilYmd(d ?? "")}
                      placeholder="Optional"
                      minYmd={displayFromYmd || undefined}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">Uhrzeit</span>
                    <Input
                      type="time"
                      value={displayUntilHm}
                      onChange={(e) => setDisplayUntilHm(e.target.value)}
                      disabled={!displayUntilYmd}
                      className={cn(staffDrawerFieldClassName, formScheduleTimeInputClassName)}
                    />
                  </div>
                </div>
                <div className="space-y-3 rounded-xl border border-border/40 p-4">
                  <p className="text-sm font-medium">Popup am Display</p>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={showOnPinLogin}
                      onCheckedChange={(c) => setShowOnPinLogin(c === true)}
                    />
                    Bei PIN-Anmeldung
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={showBeforeClockIn}
                      onCheckedChange={(c) => setShowBeforeClockIn(c === true)}
                    />
                    Vor Schichtbeginn
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={showBeforeBreakStart}
                      onCheckedChange={(c) => setShowBeforeBreakStart(c === true)}
                    />
                    Vor Pausenbeginn
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={showBeforeBreakEnd}
                      onCheckedChange={(c) => setShowBeforeBreakEnd(c === true)}
                    />
                    Vor Pausenende
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={showBeforeClockOut}
                      onCheckedChange={(c) => setShowBeforeClockOut(c === true)}
                    />
                    Vor Schichtende
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={requireDeferReason}
                      onCheckedChange={(c) => setRequireDeferReason(c === true)}
                    />
                    Grund bei Verschieben erforderlich
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={blocksShiftEnd}
                      onCheckedChange={(c) => setBlocksShiftEnd(c === true)}
                    />
                    Schichtende blockieren bis erfasst
                  </label>
                </div>
              </div>
            </DrawerFormSection>

            <DrawerFormSection title="Felder">
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="space-y-3 rounded-xl border border-border/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Feld {index + 1}</p>
                      {items.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() =>
                            setItems((prev) => prev.filter((x) => x.id !== item.id))
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Bezeichnung</Label>
                        <Input
                          value={item.label}
                          onChange={(e) =>
                            updateItem(item.id, { label: e.target.value })
                          }
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Feldtyp</Label>
                        <SearchableSelect
                          value={item.fieldType}
                          onValueChange={(v) =>
                            updateItem(item.id, {
                              fieldType: v as ComplianceFieldType,
                            })
                          }
                          options={COMPLIANCE_FIELD_TYPES.map((t) => ({
                            value: t,
                            label: COMPLIANCE_FIELD_TYPE_LABELS[t],
                          }))}
                          className={selectClass}
                        />
                      </div>
                      {(item.fieldType === "temperature" ||
                        item.fieldType === "number") && (
                        <>
                          <div className="space-y-2">
                            <Label>Min (optional)</Label>
                            <Input
                              type="number"
                              value={item.minValue ?? ""}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  minValue:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                              className="rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Max (optional)</Label>
                            <Input
                              type="number"
                              value={item.maxValue ?? ""}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  maxValue:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                              className="rounded-xl"
                            />
                          </div>
                        </>
                      )}
                      {item.fieldType === "temperature" && devices.length > 0 ? (
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Gerät (optional)</Label>
                          <SearchableSelect
                            value={item.deviceId ?? ""}
                            onValueChange={(v) =>
                              updateItem(item.id, {
                                deviceId: v || null,
                                ...(v
                                  ? (() => {
                                      const dev = devices.find((d) => d.id === v);
                                      if (!dev) return {};
                                      return {
                                        label: dev.name,
                                        minValue: dev.target_min,
                                        maxValue: dev.target_max,
                                      };
                                    })()
                                  : {}),
                              })
                            }
                            options={[
                              { value: "", label: "Kein Gerät" },
                              ...devices.map((d) => ({
                                value: d.id,
                                label: d.name,
                              })),
                            ]}
                            className={selectClass}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={() =>
                    setItems((prev) => [...prev, emptyItem(category)])
                  }
                >
                  <Plus className="size-4" />
                  Feld hinzufügen
                </Button>
              </div>
            </DrawerFormSection>
            </DrawerFormScrollArea>
          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            onSubmit={() => void save()}
            submitType="button"
            submitPending={saving}
            submitLabel={isEdit ? "Speichern" : "Anlegen"}
            showDelete={isEdit && canDelete}
            onDelete={() => setConfirmArchive(true)}
            deleteLabel="Archivieren"
          />
          </DrawerFormBody>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Vorlage archivieren?"
        description="Die Vorlage kann nicht mehr erfasst werden, bestehende Einträge bleiben erhalten."
        confirmLabel="Archivieren"
        onConfirm={() => void archive()}
      />
    </>
  );
}
