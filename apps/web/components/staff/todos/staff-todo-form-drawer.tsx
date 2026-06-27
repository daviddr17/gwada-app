"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  DatePickerField,
  formScheduleTimeInputFullWidthClassName,
} from "@/components/ui/date-picker";
import {
  datetimeLocalValueToIso,
  datetimeLocalValueToYmdHm,
  isoToDatetimeLocalValue,
  ymdAndHmToDatetimeLocal,
} from "@/lib/reservations/datetime-local";
import { SearchableSelect, SearchableMultiSelect } from "@/components/ui/combobox";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  archiveStaffTodo,
  assignedStaffIds,
  assignedPositionTagIds,
  insertStaffTodoLogEntry,
  upsertStaffTodo,
} from "@/lib/supabase/staff-todos-db";
import type {
  RestaurantStaffTodoRow,
  StaffTodoCaptureType,
  StaffTodoCompletionMode,
  StaffTodoPriority,
  StaffTodoRecurrence,
  StaffTodoUpsertInput,
} from "@/lib/types/staff-todos";
import {
  STAFF_TODO_CAPTURE_TYPE_LABELS,
  STAFF_TODO_CAPTURE_TYPES,
  STAFF_TODO_COMPLETION_MODE_LABELS,
  STAFF_TODO_PRIORITY_LABELS,
  STAFF_TODO_PRIORITY_COLORS,
  STAFF_TODO_RECURRENCE_LABELS,
  STAFF_TODO_RECURRENCES,
} from "@/lib/types/staff-todos";
import { MenuTaxonomyDrawer } from "@/components/menu/menu-taxonomy-drawer";
import { ChecklistDeviceFormDrawer } from "@/components/checklisten/checklist-device-form-drawer";
import type { ChecklistAreaDefinition } from "@/lib/types/checklist-areas-devices";
import type {
  ChecklistDeviceUpsertInput,
  RestaurantChecklistDeviceRow,
} from "@/lib/types/checklist-areas-devices";
import { staffDisplayName, type RestaurantStaffRow } from "@/lib/types/staff";
import type { StaffPositionTagDefinition } from "@/lib/types/staff";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DisplayPopupMultiSelect } from "@/components/checklisten/display-popup-multi-select";
import { displayPopupHasTrigger } from "@/lib/staff/display-popup-options";
import { hasModuleDelete } from "@/lib/permissions/module-crud-permissions";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { fetchComplianceSettings } from "@/lib/supabase/compliance-db";
import { cn } from "@/lib/utils";

const selectClass = appSelectTriggerAccentCn(staffDrawerFieldClassName);
const drawerTwoColClass = "grid gap-3 sm:grid-cols-2";

function isoToYmdHm(iso: string | null | undefined): { ymd: string; hm: string } {
  if (!iso) return { ymd: "", hm: "" };
  return datetimeLocalValueToYmdHm(isoToDatetimeLocalValue(iso));
}

function ymdHmToIso(ymd: string, hm: string): string | null {
  if (!ymd.trim()) return null;
  return datetimeLocalValueToIso(ymdAndHmToDatetimeLocal(ymd, hm || "00:00"));
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type StaffTodoFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  todo: RestaurantStaffTodoRow | null;
  staffList: readonly RestaurantStaffRow[];
  positionTags: readonly StaffPositionTagDefinition[];
  checklistAreas: readonly ChecklistAreaDefinition[];
  checklistDevices: readonly RestaurantChecklistDeviceRow[];
  canManageChecklistTaxonomy?: boolean;
  onAddChecklistArea?: (
    name: string,
    active?: boolean,
    backgroundColor?: string,
  ) => Promise<{ id: string; name: string } | null>;
  onUpsertChecklistDevice?: (
    input: ChecklistDeviceUpsertInput,
    deviceId?: string | null,
  ) => Promise<RestaurantChecklistDeviceRow | null>;
  onSaved: () => void;
};

export function StaffTodoFormDrawer({
  open,
  onOpenChange,
  restaurantId,
  todo,
  staffList,
  positionTags,
  checklistAreas,
  checklistDevices,
  canManageChecklistTaxonomy = false,
  onAddChecklistArea,
  onUpsertChecklistDevice,
  onSaved,
}: StaffTodoFormDrawerProps) {
  const { has } = useRestaurantPermissions();
  const canDelete = hasModuleDelete(has, "staff_todos");
  const isEdit = todo != null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [positionTagIds, setPositionTagIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<StaffTodoPriority>("medium");
  const [displayFromYmd, setDisplayFromYmd] = useState("");
  const [displayFromHm, setDisplayFromHm] = useState("");
  const [displayUntilYmd, setDisplayUntilYmd] = useState("");
  const [displayUntilHm, setDisplayUntilHm] = useState("");
  const [completionMode, setCompletionMode] =
    useState<StaffTodoCompletionMode>("any_one");
  const [showOnDisplay, setShowOnDisplay] = useState(true);
  const [showBeforeClockIn, setShowBeforeClockIn] = useState(false);
  const [showBeforeBreakStart, setShowBeforeBreakStart] = useState(false);
  const [showBeforeBreakEnd, setShowBeforeBreakEnd] = useState(false);
  const [showBeforeClockOut, setShowBeforeClockOut] = useState(false);
  const [showOnPinLogin, setShowOnPinLogin] = useState(false);
  const [requireDeferReason, setRequireDeferReason] = useState(false);
  const [blocksShiftEnd, setBlocksShiftEnd] = useState(false);
  const [allowReopenOnDisplay, setAllowReopenOnDisplay] = useState(false);
  const [recurrence, setRecurrence] = useState<string>("");
  const [captureType, setCaptureType] = useState<StaffTodoCaptureType>("boolean");
  const [checklistAreaId, setChecklistAreaId] = useState("");
  const [checklistDeviceId, setChecklistDeviceId] = useState("");
  const [targetMin, setTargetMin] = useState("");
  const [targetMax, setTargetMax] = useState("");
  const [requireCorrectiveOnDeviation, setRequireCorrectiveOnDeviation] =
    useState(false);
  const [defaultCorrectiveOnDeviation, setDefaultCorrectiveOnDeviation] =
    useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [areaCreateOpen, setAreaCreateOpen] = useState(false);
  const [deviceCreateOpen, setDeviceCreateOpen] = useState(false);

  const resetFromTodo = useCallback(() => {
    if (!todo) {
      setTitle("");
      setDescription("");
      setStaffIds(staffList.filter((s) => s.is_active)[0]?.id ? [staffList.filter((s) => s.is_active)[0]!.id] : []);
      setPositionTagIds([]);
      setPriority("medium");
      setDisplayFromYmd("");
      setDisplayFromHm("");
      setDisplayUntilYmd("");
      setDisplayUntilHm("");
      setCompletionMode("any_one");
      setShowOnDisplay(true);
      setShowBeforeClockIn(false);
      setShowBeforeBreakStart(false);
      setShowBeforeBreakEnd(false);
      setShowBeforeClockOut(false);
      setShowOnPinLogin(false);
      setRequireDeferReason(false);
      setBlocksShiftEnd(false);
      setAllowReopenOnDisplay(false);
      setRecurrence("");
      setCaptureType("boolean");
      setChecklistAreaId("");
      setChecklistDeviceId("");
      setTargetMin("");
      setTargetMax("");
      setRequireCorrectiveOnDeviation(defaultCorrectiveOnDeviation);
      return;
    }
    setTitle(todo.title);
    setDescription(todo.description ?? "");
    setStaffIds(assignedStaffIds(todo));
    setPositionTagIds(assignedPositionTagIds(todo));
    setPriority(todo.priority);
    const from = isoToYmdHm(todo.display_from);
    const until = isoToYmdHm(todo.display_until);
    setDisplayFromYmd(from.ymd);
    setDisplayFromHm(from.hm);
    setDisplayUntilYmd(until.ymd);
    setDisplayUntilHm(until.hm);
    setCompletionMode(todo.completion_mode);
    setShowOnDisplay(todo.show_on_display);
    setShowBeforeClockIn(todo.show_before_clock_in);
    setShowBeforeBreakStart(todo.show_before_break_start);
    setShowBeforeBreakEnd(todo.show_before_break_end);
    setShowBeforeClockOut(todo.show_before_clock_out);
    setShowOnPinLogin(todo.show_on_pin_login ?? false);
    setRequireDeferReason(todo.require_defer_reason);
    setBlocksShiftEnd(todo.blocks_shift_end);
    setAllowReopenOnDisplay(todo.allow_reopen_on_display ?? false);
    setRecurrence(todo.recurrence ?? "");
    setCaptureType(todo.capture_type ?? "boolean");
    setChecklistAreaId(todo.checklist_area_id ?? "");
    setChecklistDeviceId(todo.checklist_device_id ?? "");
    setTargetMin(todo.target_min != null ? String(todo.target_min) : "");
    setTargetMax(todo.target_max != null ? String(todo.target_max) : "");
    setRequireCorrectiveOnDeviation(todo.require_corrective_on_deviation ?? false);
  }, [todo, staffList, positionTags, defaultCorrectiveOnDeviation]);

  useEffect(() => {
    if (!restaurantId || !open) return;
    void fetchComplianceSettings(restaurantId).then(({ data }) => {
      setDefaultCorrectiveOnDeviation(
        data?.require_corrective_on_deviation ?? true,
      );
    });
  }, [restaurantId, open]);

  useEffect(() => {
    if (!open) return;
    if (!todo) return;
    resetFromTodo();
  }, [open, todo, resetFromTodo]);

  useEffect(() => {
    if (!open || todo) return;
    resetFromTodo();
  }, [open, todo, defaultCorrectiveOnDeviation, resetFromTodo]);

  const handleDeviceChange = (id: string) => {
    setChecklistDeviceId(id);
    if (!id) return;
    const dev = checklistDevices.find((d) => d.id === id);
    if (!dev) return;
    if (dev.area_id) setChecklistAreaId(dev.area_id);
    if (captureType === "temperature") {
      if (dev.target_min != null) setTargetMin(String(dev.target_min));
      if (dev.target_max != null) setTargetMax(String(dev.target_max));
    }
  };

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
        .map((t) => ({
          value: t.id,
          label: t.name,
          leadingColor: t.backgroundColor,
        })),
    [positionTags],
  );

  const priorityOptions = (
    Object.entries(STAFF_TODO_PRIORITY_LABELS) as [StaffTodoPriority, string][]
  ).map(([value, label]) => ({
    value,
    label,
    leadingColor: STAFF_TODO_PRIORITY_COLORS[value],
  }));

  const completionOptions = (
    Object.entries(STAFF_TODO_COMPLETION_MODE_LABELS) as [
      StaffTodoCompletionMode,
      string,
    ][]
  ).map(([value, label]) => ({ value, label }));

  const areaOptions = useMemo(
    () => [
      { value: "", label: "Kein Bereich" },
      ...checklistAreas
        .filter((a) => a.active)
        .map((a) => ({ value: a.id, label: a.name })),
    ],
    [checklistAreas],
  );

  const deviceOptions = useMemo(
    () => [
      { value: "", label: "Kein Gerät" },
      ...checklistDevices
        .filter((d) => d.is_active)
        .map((d) => ({ value: d.id, label: d.name })),
    ],
    [checklistDevices],
  );

  const recurrenceOptions = useMemo(
    () => [
      { value: "", label: "Einmalig / manuell" },
      ...STAFF_TODO_RECURRENCES.map((r) => ({
        value: r,
        label: STAFF_TODO_RECURRENCE_LABELS[r],
      })),
    ],
    [],
  );

  const captureOptions = useMemo(
    () =>
      STAFF_TODO_CAPTURE_TYPES.map((c) => ({
        value: c,
        label: STAFF_TODO_CAPTURE_TYPE_LABELS[c],
      })),
    [],
  );

  const showLimits =
    captureType === "temperature" || captureType === "number";

  const buildInput = (): StaffTodoUpsertInput | null => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Titel ist erforderlich.");
      return null;
    }
    if (staffIds.length === 0 && positionTagIds.length === 0) {
      toast.error("Bitte mindestens einen Mitarbeiter oder eine Position wählen.");
      return null;
    }
    return {
      title: trimmed,
      description: description.trim() || null,
      staff_ids: staffIds,
      position_tag_ids: positionTagIds,
      priority,
      display_from: ymdHmToIso(displayFromYmd, displayFromHm),
      display_until: ymdHmToIso(displayUntilYmd, displayUntilHm),
      completion_mode: completionMode,
      show_on_display:
        showOnDisplay ||
        displayPopupHasTrigger({
          showOnPinLogin,
          showBeforeClockIn,
          showBeforeBreakStart,
          showBeforeBreakEnd,
          showBeforeClockOut,
          requireDeferReason,
          blocksShiftEnd,
        }),
      show_before_clock_in: showBeforeClockIn,
      show_before_break_start: showBeforeBreakStart,
      show_before_break_end: showBeforeBreakEnd,
      show_before_clock_out: showBeforeClockOut,
      show_on_pin_login: showOnPinLogin,
      require_defer_reason: requireDeferReason,
      blocks_shift_end: blocksShiftEnd,
      allow_reopen_on_display: allowReopenOnDisplay,
      recurrence: (recurrence || null) as StaffTodoRecurrence | null,
      capture_type: captureType,
      checklist_area_id: checklistAreaId || null,
      checklist_device_id: checklistDeviceId || null,
      target_min: showLimits ? parseOptionalNumber(targetMin) : null,
      target_max: showLimits ? parseOptionalNumber(targetMax) : null,
      require_corrective_on_deviation: showLimits
        ? requireCorrectiveOnDeviation
        : false,
    };
  };

  const handleSave = async () => {
    const input = buildInput();
    if (!input) return;
    setSaving(true);
    const { data, error } = await upsertStaffTodo(restaurantId, input, todo?.id);
    setSaving(false);
    if (error || !data) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    await insertStaffTodoLogEntry({
      restaurantId,
      todoId: data.id,
      action: isEdit ? "updated" : "created",
      details: { title: data.title },
    });
    toast.success(isEdit ? "ToDo gespeichert." : "ToDo angelegt.");
    onSaved();
    onOpenChange(false);
  };

  const handleArchive = async () => {
    if (!todo) return;
    setSaving(true);
    const { error } = await archiveStaffTodo(restaurantId, todo.id);
    if (!error) {
      await insertStaffTodoLogEntry({
        restaurantId,
        todoId: todo.id,
        action: "archived",
        details: { title: todo.title },
      });
    }
    setSaving(false);
    setConfirmArchive(false);
    if (error) toast.error(error);
    else {
      toast.success("ToDo archiviert.");
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className={drawerContentClassName("formStaff")}>
          <DrawerHeader>
            <DrawerTitle>{isEdit ? "ToDo bearbeiten" : "Neues ToDo"}</DrawerTitle>
            <DrawerDescription>
              Aufgabe zuweisen, Priorität und Anzeigezeitraum festlegen.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFormBody>
          <div className={staffDrawerScrollClassName}>
            <DrawerFormSection title="Titel">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z. B. Kühlhaus prüfen"
                className={staffDrawerFieldClassName}
              />
            </DrawerFormSection>
            <DrawerFormSection title="Beschreibung">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={staffDrawerFieldClassName}
              />
            </DrawerFormSection>
            <DrawerFormSection title="Zuteilung">
              <div className="space-y-3">
                <div className="space-y-2">
                  <span className="text-sm font-medium">Bereich</span>
                  <SearchableSelect
                    value={checklistAreaId}
                    onValueChange={setChecklistAreaId}
                    options={areaOptions}
                    className={selectClass}
                    footerAction={
                      canManageChecklistTaxonomy && onAddChecklistArea
                        ? {
                            label: "Neuer Bereich",
                            onSelect: () => setAreaCreateOpen(true),
                          }
                        : undefined
                    }
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Gerät</span>
                  <SearchableSelect
                    value={checklistDeviceId}
                    onValueChange={handleDeviceChange}
                    options={deviceOptions}
                    className={selectClass}
                    footerAction={
                      canManageChecklistTaxonomy && onUpsertChecklistDevice
                        ? {
                            label: "Neues Gerät",
                            onSelect: () => setDeviceCreateOpen(true),
                          }
                        : undefined
                    }
                  />
                </div>
              </div>
            </DrawerFormSection>
            <DrawerFormSection title="Erfassung">
              <div className="space-y-3">
                <SearchableSelect
                  value={captureType}
                  onValueChange={(v) => setCaptureType(v as StaffTodoCaptureType)}
                  options={captureOptions}
                  className={selectClass}
                />
                {showLimits ? (
                  <div className={drawerTwoColClass}>
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">
                        {captureType === "temperature" ? "Min. °C" : "Min."}
                      </span>
                      <Input
                        inputMode="decimal"
                        value={targetMin}
                        onChange={(e) => setTargetMin(e.target.value)}
                        className={staffDrawerFieldClassName}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">
                        {captureType === "temperature" ? "Max. °C" : "Max."}
                      </span>
                      <Input
                        inputMode="decimal"
                        value={targetMax}
                        onChange={(e) => setTargetMax(e.target.value)}
                        className={staffDrawerFieldClassName}
                      />
                    </div>
                  </div>
                ) : null}
                {showLimits ? (
                  <div className="flex items-center justify-between gap-4">
                    <Label
                      htmlFor="staff-todo-corrective-required"
                      className="text-sm font-medium"
                    >
                      Korrekturmaßnahme bei Abweichung erforderlich (nur dieses ToDo)
                    </Label>
                    <Switch
                      id="staff-todo-corrective-required"
                      checked={requireCorrectiveOnDeviation}
                      onCheckedChange={(v) =>
                        setRequireCorrectiveOnDeviation(v === true)
                      }
                    />
                  </div>
                ) : null}
              </div>
            </DrawerFormSection>
            <DrawerFormSection title="Wiederholung">
              <SearchableSelect
                value={recurrence}
                onValueChange={setRecurrence}
                options={recurrenceOptions}
                className={selectClass}
              />
            </DrawerFormSection>
            <DrawerFormSection title="Zuständigkeit">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Mitarbeiter</p>
                  <SearchableMultiSelect
                    options={staffOptions}
                    value={staffIds}
                    onChange={setStaffIds}
                    placeholder="Mitarbeiter wählen …"
                    searchPlaceholder="Weitere suchen …"
                    emptyMessage="Keine aktiven Mitarbeiter."
                    aria-label="Mitarbeiter"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Positionen</p>
                  <SearchableMultiSelect
                    options={tagOptions}
                    value={positionTagIds}
                    onChange={setPositionTagIds}
                    placeholder="Positionen wählen …"
                    searchPlaceholder="Weitere suchen …"
                    emptyMessage="Keine aktiven Positionen."
                    aria-label="Positionen"
                  />
                </div>
              </div>
            </DrawerFormSection>
            <DrawerFormSection title="Priorität">
              <SearchableSelect
                value={priority}
                onValueChange={(v) => setPriority(v as StaffTodoPriority)}
                options={priorityOptions}
                className={selectClass}
              />
            </DrawerFormSection>
            <DrawerFormSection title="Sichtbar ab Datum / Uhrzeit">
              <div className={drawerTwoColClass}>
                <DatePickerField
                  fullWidth
                  value={displayFromYmd || null}
                  onChange={(d) => setDisplayFromYmd(d ?? "")}
                  placeholder="Optional"
                  className="w-full"
                />
                <Input
                  type="time"
                  value={displayFromHm}
                  onChange={(e) => setDisplayFromHm(e.target.value)}
                  disabled={!displayFromYmd}
                  className={formScheduleTimeInputFullWidthClassName}
                />
              </div>
            </DrawerFormSection>
            <DrawerFormSection title="Fällig bis Datum / Uhrzeit">
              <div className={drawerTwoColClass}>
                <DatePickerField
                  fullWidth
                  value={displayUntilYmd || null}
                  onChange={(d) => setDisplayUntilYmd(d ?? "")}
                  placeholder="Optional"
                  className="w-full"
                  minYmd={displayFromYmd || undefined}
                />
                <Input
                  type="time"
                  value={displayUntilHm}
                  onChange={(e) => setDisplayUntilHm(e.target.value)}
                  disabled={!displayUntilYmd}
                  className={formScheduleTimeInputFullWidthClassName}
                />
              </div>
            </DrawerFormSection>
            <DrawerFormSection title="Erledigung">
              <SearchableSelect
                value={completionMode}
                onValueChange={(v) =>
                  setCompletionMode(v as StaffTodoCompletionMode)
                }
                options={completionOptions}
                className={selectClass}
              />
            </DrawerFormSection>
            <DrawerFormSection title="Display">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Label
                    htmlFor="staff-todo-show-on-display"
                    className="text-sm font-medium"
                  >
                    Anzeigen
                  </Label>
                  <Switch
                    id="staff-todo-show-on-display"
                    checked={showOnDisplay}
                    onCheckedChange={(v) => setShowOnDisplay(v === true)}
                  />
                </div>
                {showOnDisplay ? (
                  <DisplayPopupMultiSelect
                    includeAllowReopen
                    blocksShiftEndLabel="Schichtende blockieren bis erledigt"
                    flags={{
                      showOnPinLogin,
                      showBeforeClockIn,
                      showBeforeBreakStart,
                      showBeforeBreakEnd,
                      showBeforeClockOut,
                      requireDeferReason,
                      blocksShiftEnd,
                      allowReopenOnDisplay,
                    }}
                    onChange={(next) => {
                      setShowOnPinLogin(next.showOnPinLogin);
                      setShowBeforeClockIn(next.showBeforeClockIn);
                      setShowBeforeBreakStart(next.showBeforeBreakStart);
                      setShowBeforeBreakEnd(next.showBeforeBreakEnd);
                      setShowBeforeClockOut(next.showBeforeClockOut);
                      setRequireDeferReason(next.requireDeferReason);
                      setBlocksShiftEnd(next.blocksShiftEnd);
                      setAllowReopenOnDisplay(next.allowReopenOnDisplay ?? false);
                    }}
                  />
                ) : null}
              </div>
            </DrawerFormSection>
          </div>
          <DrawerFormFooter
            submitPending={saving}
            submitType="button"
            onSubmit={() => void handleSave()}
            onCancel={() => onOpenChange(false)}
            showDelete={isEdit && canDelete}
            deleteLabel="Archivieren"
            onDelete={() => setConfirmArchive(true)}
            deleteDisabled={saving}
          />
          </DrawerFormBody>
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="ToDo archivieren?"
        description="Das ToDo verschwindet aus der Liste, bleibt aber im Protokoll nachvollziehbar."
        confirmLabel="Archivieren"
        onConfirm={() => void handleArchive()}
      />
      {canManageChecklistTaxonomy && onAddChecklistArea ? (
        <MenuTaxonomyDrawer
          open={areaCreateOpen}
          onOpenChange={setAreaCreateOpen}
          mode="create"
          variant="checklistAreas"
          onSave={(payload) => {
            if ("id" in payload) return;
            void (async () => {
              const created = await onAddChecklistArea(
                payload.name,
                payload.active ?? true,
                payload.backgroundColor,
              );
              if (created) {
                setChecklistAreaId(created.id);
                setAreaCreateOpen(false);
              }
            })();
          }}
        />
      ) : null}
      {canManageChecklistTaxonomy && onUpsertChecklistDevice ? (
        <ChecklistDeviceFormDrawer
          open={deviceCreateOpen}
          onOpenChange={setDeviceCreateOpen}
          device={null}
          areas={checklistAreas}
          onSave={async (input, deviceId) => {
            const created = await onUpsertChecklistDevice(input, deviceId);
            if (created) {
              handleDeviceChange(created.id);
              setDeviceCreateOpen(false);
              return true;
            }
            return false;
          }}
        />
      ) : null}
    </>
  );
}
