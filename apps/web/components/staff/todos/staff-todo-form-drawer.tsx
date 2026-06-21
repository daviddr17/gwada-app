"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
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
  formScheduleTimeInputClassName,
} from "@/components/ui/date-picker";
import {
  datetimeLocalValueToIso,
  datetimeLocalValueToYmdHm,
  isoToDatetimeLocalValue,
  ymdAndHmToDatetimeLocal,
} from "@/lib/reservations/datetime-local";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  archiveStaffTodo,
  insertStaffTodoLogEntry,
  upsertStaffTodo,
} from "@/lib/supabase/staff-todos-db";
import type {
  RestaurantStaffTodoRow,
  StaffTodoAssigneeType,
  StaffTodoCompletionMode,
  StaffTodoPriority,
  StaffTodoUpsertInput,
} from "@/lib/types/staff-todos";
import {
  STAFF_TODO_COMPLETION_MODE_LABELS,
  STAFF_TODO_PRIORITY_LABELS,
} from "@/lib/types/staff-todos";
import { staffDisplayName, type RestaurantStaffRow } from "@/lib/types/staff";
import type { StaffPositionTagDefinition } from "@/lib/types/staff";
import { Checkbox } from "@/components/ui/checkbox";
import { hasModuleDelete } from "@/lib/permissions/module-crud-permissions";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
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

type StaffTodoFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  todo: RestaurantStaffTodoRow | null;
  staffList: readonly RestaurantStaffRow[];
  positionTags: readonly StaffPositionTagDefinition[];
  onSaved: () => void;
};

export function StaffTodoFormDrawer({
  open,
  onOpenChange,
  restaurantId,
  todo,
  staffList,
  positionTags,
  onSaved,
}: StaffTodoFormDrawerProps) {
  const { has } = useRestaurantPermissions();
  const canDelete = hasModuleDelete(has, "staff_todos");
  const isEdit = todo != null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeType, setAssigneeType] = useState<StaffTodoAssigneeType>("staff");
  const [staffId, setStaffId] = useState("");
  const [positionTagId, setPositionTagId] = useState("");
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
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const resetFromTodo = useCallback(() => {
    if (!todo) {
      setTitle("");
      setDescription("");
      setAssigneeType("staff");
      setStaffId(staffList[0]?.id ?? "");
      setPositionTagId(positionTags[0]?.id ?? "");
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
      return;
    }
    setTitle(todo.title);
    setDescription(todo.description ?? "");
    setAssigneeType(todo.assignee_type);
    setStaffId(todo.staff_id ?? "");
    setPositionTagId(todo.position_tag_id ?? "");
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
  }, [todo, staffList, positionTags]);

  useEffect(() => {
    if (open) resetFromTodo();
  }, [open, resetFromTodo]);

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

  const assigneeTypeOptions = [
    { value: "staff", label: "Einzelperson" },
    { value: "position_tag", label: "Position (Tag)" },
  ];

  const priorityOptions = (
    Object.entries(STAFF_TODO_PRIORITY_LABELS) as [StaffTodoPriority, string][]
  ).map(([value, label]) => ({ value, label }));

  const completionOptions = (
    Object.entries(STAFF_TODO_COMPLETION_MODE_LABELS) as [
      StaffTodoCompletionMode,
      string,
    ][]
  ).map(([value, label]) => ({ value, label }));

  const buildInput = (): StaffTodoUpsertInput | null => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Titel ist erforderlich.");
      return null;
    }
    if (assigneeType === "staff" && !staffId) {
      toast.error("Bitte einen Mitarbeiter wählen.");
      return null;
    }
    if (assigneeType === "position_tag" && !positionTagId) {
      toast.error("Bitte eine Position wählen.");
      return null;
    }
    return {
      title: trimmed,
      description: description.trim() || null,
      assignee_type: assigneeType,
      staff_id: assigneeType === "staff" ? staffId : null,
      position_tag_id: assigneeType === "position_tag" ? positionTagId : null,
      priority,
      display_from: ymdHmToIso(displayFromYmd, displayFromHm),
      display_until: ymdHmToIso(displayUntilYmd, displayUntilHm),
      completion_mode: completionMode,
      show_on_display:
        showOnDisplay ||
        showOnPinLogin ||
        showBeforeClockIn ||
        showBeforeBreakStart ||
        showBeforeBreakEnd ||
        showBeforeClockOut,
      show_before_clock_in: showBeforeClockIn,
      show_before_break_start: showBeforeBreakStart,
      show_before_break_end: showBeforeBreakEnd,
      show_before_clock_out: showBeforeClockOut,
      show_on_pin_login: showOnPinLogin,
      require_defer_reason: requireDeferReason,
      blocks_shift_end: blocksShiftEnd,
      allow_reopen_on_display: allowReopenOnDisplay,
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
            <DrawerFormSection title="Zuordnung">
              <SearchableSelect
                value={assigneeType}
                onValueChange={(v) => setAssigneeType(v as StaffTodoAssigneeType)}
                options={assigneeTypeOptions}
                className={selectClass}
              />
            </DrawerFormSection>
            {assigneeType === "staff" ? (
              <DrawerFormSection title="Mitarbeiter">
                <SearchableSelect
                  value={staffId}
                  onValueChange={setStaffId}
                  options={staffOptions}
                  className={selectClass}
                />
              </DrawerFormSection>
            ) : (
              <DrawerFormSection title="Position">
                <SearchableSelect
                  value={positionTagId}
                  onValueChange={setPositionTagId}
                  options={tagOptions}
                  className={selectClass}
                />
              </DrawerFormSection>
            )}
            <DrawerFormSection title="Priorität">
              <SearchableSelect
                value={priority}
                onValueChange={(v) => setPriority(v as StaffTodoPriority)}
                options={priorityOptions}
                className={selectClass}
              />
            </DrawerFormSection>
            <DrawerFormSection title="Sichtbar ab">
              <div className={drawerTwoColClass}>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Datum</span>
                  <DatePickerField
                    fullWidth
                    value={displayFromYmd || null}
                    onChange={(d) => setDisplayFromYmd(d ?? "")}
                    placeholder="Optional"
                    className="w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Uhrzeit</span>
                  <Input
                    type="time"
                    value={displayFromHm}
                    onChange={(e) => setDisplayFromHm(e.target.value)}
                    disabled={!displayFromYmd}
                    className={cn(
                      staffDrawerFieldClassName,
                      formScheduleTimeInputClassName,
                      "w-full",
                    )}
                  />
                </div>
              </div>
            </DrawerFormSection>
            <DrawerFormSection title="Fällig bis">
              <div className={drawerTwoColClass}>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Datum</span>
                  <DatePickerField
                    fullWidth
                    value={displayUntilYmd || null}
                    onChange={(d) => setDisplayUntilYmd(d ?? "")}
                    placeholder="Optional"
                    className="w-full"
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
                    className={cn(
                      staffDrawerFieldClassName,
                      formScheduleTimeInputClassName,
                      "w-full",
                    )}
                  />
                </div>
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
            <div className="space-y-3 px-4 pb-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={showOnDisplay}
                  onCheckedChange={(c) => setShowOnDisplay(c === true)}
                />
                Auf Display anzeigen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={showOnPinLogin}
                  onCheckedChange={(c) => setShowOnPinLogin(c === true)}
                />
                Popup bei jeder PIN-Anmeldung am Display
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={showBeforeClockIn}
                  onCheckedChange={(c) => setShowBeforeClockIn(c === true)}
                />
                Popup vor Schichtbeginn
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={showBeforeBreakStart}
                  onCheckedChange={(c) => setShowBeforeBreakStart(c === true)}
                />
                Popup vor Pausenbeginn
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={showBeforeBreakEnd}
                  onCheckedChange={(c) => setShowBeforeBreakEnd(c === true)}
                />
                Popup vor Pausenende
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={showBeforeClockOut}
                  onCheckedChange={(c) => setShowBeforeClockOut(c === true)}
                />
                Popup vor Schichtende
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
                Schichtende blockieren bis erledigt
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allowReopenOnDisplay}
                  onCheckedChange={(c) => setAllowReopenOnDisplay(c === true)}
                />
                Erledigung am Display rückgängig machen
              </label>
            </div>
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
    </>
  );
}
