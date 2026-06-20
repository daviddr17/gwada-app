"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CategoryDrawer } from "@/components/menu/category-drawer";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
import { cn } from "@/lib/utils";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  deleteStaffContract,
  fetchStaffContractLogEntries,
  upsertStaffContract,
} from "@/lib/supabase/staff-db";
import {
  buildStaffContractChanges,
  formatStaffContractLogActorLabel,
  formatStaffContractLogSummary,
  insertStaffContractLogEntry,
} from "@/lib/staff/staff-contract-log";
import { notifyStaffContractsUpdated } from "@/lib/staff/staff-contract-events";
import {
  isStaffFixedPayType,
  staffFixedPayInputLabel,
  staffFixedPayValidationError,
} from "@/lib/staff/staff-contract-pay";
import {
  findOverlappingStaffContract,
  formatStaffContractDateDe,
  formatStaffContractEndDe,
  formatStaffContractPeriodDe,
} from "@/lib/staff/staff-contract-period";
import type {
  RestaurantStaffContractLogEntry,
  RestaurantStaffContractRow,
  StaffContractPayType,
  StaffEmploymentTypeDefinition,
} from "@/lib/types/staff";
import {
  STAFF_CONTRACT_PAY_ITEMS,
  STAFF_CONTRACT_PAY_LABELS,
  STAFF_CONTRACT_PAY_TYPES,
} from "@/lib/types/staff";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const NEW_EMPLOYMENT_TYPE_VALUE = "__new_employment_type__";

const EMPLOYMENT_CREATE_DRAWER_LABELS = {
  titleCreate: "Beschäftigungsverhältnis hinzufügen",
  titleEdit: "Beschäftigungsverhältnis bearbeiten",
  description: "Name und Sichtbarkeit — z. B. Vollzeit, Minijob, Werkstudent.",
  nameLabel: "Name",
  namePlaceholder: "z. B. Vollzeit",
  activeLabel: "Aktiv",
  activeDescription:
    "Inaktive Beschäftigungsverhältnisse stehen bei neuen Verträgen nicht zur Auswahl.",
};

type StaffContractDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  staffId: string;
  staffName?: string | null;
  contract: RestaurantStaffContractRow | null;
  existingContracts: readonly RestaurantStaffContractRow[];
  employmentTypes: readonly StaffEmploymentTypeDefinition[];
  onAddEmploymentType: (
    name: string,
    active?: boolean,
  ) => Promise<{ id: string; name: string } | null>;
  onSaved: () => void;
  onDeleted: () => void;
};

export function StaffContractDrawer({
  open,
  onOpenChange,
  restaurantId,
  staffId,
  staffName,
  contract,
  existingContracts,
  employmentTypes,
  onAddEmploymentType,
  onSaved,
  onDeleted,
}: StaffContractDrawerProps) {
  const editId = contract?.id ?? null;
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [payType, setPayType] = useState<StaffContractPayType>("hourly");
  const [hourly, setHourly] = useState("");
  const [fixed, setFixed] = useState("");
  const [employmentTypeId, setEmploymentTypeId] = useState("");
  const [vacationDays, setVacationDays] = useState("");
  const [targetWeeklyHours, setTargetWeeklyHours] = useState("");
  const [note, setNote] = useState("");
  const [logEntries, setLogEntries] = useState<RestaurantStaffContractLogEntry[]>(
    [],
  );
  const [logLoading, setLogLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [employmentCreateOpen, setEmploymentCreateOpen] = useState(false);

  const selectableEmploymentTypes = useMemo(
    () =>
      employmentTypes.filter((t) => t.active || t.id === employmentTypeId),
    [employmentTypes, employmentTypeId],
  );

  const employmentSelectItems = useMemo(
    () =>
      Object.fromEntries(
        selectableEmploymentTypes.map((t) => [t.id, t.name]),
      ),
    [selectableEmploymentTypes],
  );

  useEffect(() => {
    if (!open) return;
    if (contract) {
      setValidFrom(contract.valid_from);
      setValidTo(contract.valid_to ?? "");
      setPayType(contract.pay_type);
      setHourly(
        contract.hourly_rate_cents != null
          ? String(contract.hourly_rate_cents / 100)
          : "",
      );
      setFixed(
        contract.fixed_salary_cents != null
          ? String(contract.fixed_salary_cents / 100)
          : "",
      );
      setEmploymentTypeId(contract.employment_type_id ?? "");
      setVacationDays(
        contract.vacation_days_per_year != null
          ? String(contract.vacation_days_per_year)
          : "",
      );
      setTargetWeeklyHours(
        contract.target_weekly_minutes != null
          ? String(Math.round((contract.target_weekly_minutes / 60) * 10) / 10)
          : "",
      );
      setNote(contract.note ?? "");
    } else {
      setValidFrom(new Date().toISOString().slice(0, 10));
      setValidTo("");
      setPayType("hourly");
      setHourly("");
      setFixed("");
      setEmploymentTypeId("");
      setVacationDays("");
      setTargetWeeklyHours("");
      setNote("");
    }
  }, [open, contract]);

  const reloadLog = useCallback(async () => {
    if (!editId) {
      setLogEntries([]);
      return;
    }
    setLogLoading(true);
    const { data, error } = await fetchStaffContractLogEntries(
      restaurantId,
      editId,
    );
    setLogLoading(false);
    if (error) setLogEntries([]);
    else setLogEntries(data);
  }, [restaurantId, editId]);

  useEffect(() => {
    if (!open || !editId) return;
    void reloadLog();
  }, [open, editId, reloadLog]);

  const save = async () => {
    if (!validFrom) {
      toast.error("Bitte „Gültig von“ angeben.");
      return;
    }
    if (validTo && validTo < validFrom) {
      toast.error("„Gültig bis“ darf nicht vor „Gültig von“ liegen.");
      return;
    }

    const vacationTrim = vacationDays.trim();
    let vacationDaysPerYear: number | null = null;
    if (vacationTrim) {
      const n = Number.parseInt(vacationTrim, 10);
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Urlaubstage müssen eine gültige Zahl ≥ 0 sein.");
        return;
      }
      vacationDaysPerYear = n;
    }

    let targetWeeklyMinutes: number | null = null;
    const targetRaw = targetWeeklyHours.trim();
    if (targetRaw) {
      const parsed = Number.parseFloat(targetRaw.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error("Bitte gültige Soll-Wochenstunden angeben oder leer lassen.");
        return;
      }
      targetWeeklyMinutes = Math.round(parsed * 60);
    }

    let hourlyCents: number | null = null;
    let fixedCents: number | null = null;

    if (payType === "hourly") {
      const raw = hourly.trim();
      if (!raw) {
        toast.error("Bitte einen Stundenlohn angeben.");
        return;
      }
      const parsed = Number.parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error("Bitte einen gültigen Stundenlohn größer als 0 angeben.");
        return;
      }
      hourlyCents = Math.round(parsed * 100);
    } else if (isStaffFixedPayType(payType)) {
      const raw = fixed.trim();
      if (!raw) {
        toast.error(
          payType === "fixed_weekly"
            ? "Bitte einen Wochen-Festlohn angeben."
            : "Bitte einen Festlohn angeben.",
        );
        return;
      }
      const parsed = Number.parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error(staffFixedPayValidationError(payType));
        return;
      }
      fixedCents = Math.round(parsed * 100);
    }

    const selectedEmployment = employmentTypes.find(
      (t) => t.id === employmentTypeId,
    );

    const payload = {
      valid_from: validFrom,
      valid_to: validTo || null,
      pay_type: payType,
      hourly_rate_cents: hourlyCents,
      fixed_salary_cents: fixedCents,
      currency: "EUR" as const,
      note: note.trim() || null,
      employment_type_id: employmentTypeId || null,
      employment_type_name: selectedEmployment?.name ?? null,
      vacation_days_per_year: vacationDaysPerYear,
      target_weekly_minutes: targetWeeklyMinutes,
    };

    const overlap = findOverlappingStaffContract(
      existingContracts,
      payload.valid_from,
      payload.valid_to,
      editId ?? undefined,
    );
    if (overlap) {
      toast.error(
        `Der Zeitraum überschneidet sich mit einem bestehenden Vertrag (${formatStaffContractPeriodDe(overlap.valid_from, overlap.valid_to)}).`,
      );
      return;
    }

    setPending(true);
    const res = await upsertStaffContract(restaurantId, staffId, {
      id: editId ?? undefined,
      ...payload,
    });
    if (!res.ok) {
      setPending(false);
      const hint =
        /employment_type_id|vacation_days|contract_log/i.test(res.error)
          ? " Datenbank-Migration fehlt vermutlich — bitte „npx supabase db push“ ausführen."
          : "";
      toast.error(`Vertrag konnte nicht gespeichert werden: ${res.error}${hint}`);
      return;
    }

    const changes = buildStaffContractChanges(contract, payload, employmentTypes);
    await insertStaffContractLogEntry(
      restaurantId,
      res.id,
      contract ? "updated" : "created",
      changes,
    );

    setPending(false);
    if (res.usedLegacyFields && targetWeeklyMinutes != null) {
      toast.warning(
        "Vertrag gespeichert, aber Soll-Wochenstunden fehlen in der Datenbank — bitte Migration ausführen (npx supabase db push).",
      );
    } else if (res.usedLegacyFields) {
      toast.warning(
        "Vertrag gespeichert, einige Felder konnten nicht übernommen werden — bitte Migration ausführen.",
      );
    } else {
      toast.success("Vertrag gespeichert");
    }
    notifyStaffContractsUpdated();
    onSaved();
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("form")}>
        <DrawerHeader className="shrink-0 px-5 pt-2 pb-3 text-left">
          <DrawerTitle>
            {editId ? "Vertrag bearbeiten" : "Neuer Vertrag"}
          </DrawerTitle>
          {editId && staffName?.trim() ? (
            <DrawerDescription className="text-sm text-muted-foreground">
              {staffName.trim()}
            </DrawerDescription>
          ) : null}
        </DrawerHeader>
        <div
          className={staffDrawerScrollClassName}
        >
          <DrawerFormSection title="Laufzeit" contentPadding={5}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Gültig von</Label>
              <Input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className={staffDrawerFieldClassName}
              />
            </div>
            <div className="space-y-2">
              <Label>Gültig bis</Label>
              <Input
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                className={staffDrawerFieldClassName}
              />
            </div>
          </div>
          </DrawerFormSection>

          <DrawerFormSection title="Beschäftigung & Vergütung" contentPadding={5}>
          <div className="space-y-2">
            <Label>Beschäftigungsverhältnis</Label>
            <Select
              value={employmentTypeId || ""}
              items={employmentSelectItems}
              onValueChange={(v) => {
                if (v === NEW_EMPLOYMENT_TYPE_VALUE) {
                  setEmploymentCreateOpen(true);
                  return;
                }
                if (typeof v === "string") setEmploymentTypeId(v);
              }}
            >
              <SelectTrigger
                className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
              >
                <SelectValue placeholder="Bitte wählen">
                  {employmentTypeId
                    ? employmentTypes.find((t) => t.id === employmentTypeId)
                        ?.name
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {selectableEmploymentTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem
                  value={NEW_EMPLOYMENT_TYPE_VALUE}
                  className="text-accent"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="size-4 shrink-0" />
                    Neues Beschäftigungsverhältnis
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Vergütung</Label>
            <Select
              value={payType}
              items={STAFF_CONTRACT_PAY_ITEMS}
              onValueChange={(v) => {
                if (typeof v === "string") {
                  setPayType(v as StaffContractPayType);
                }
              }}
            >
              <SelectTrigger
                className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
              >
                <SelectValue placeholder="Vergütung wählen">
                  {STAFF_CONTRACT_PAY_LABELS[payType]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STAFF_CONTRACT_PAY_TYPES.map((k) => (
                  <SelectItem key={k} value={k}>
                    {STAFF_CONTRACT_PAY_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {payType === "hourly" ? (
            <div className="space-y-2">
              <Label>Stundenlohn (€)</Label>
              <Input
                value={hourly}
                onChange={(e) => setHourly(e.target.value)}
                inputMode="decimal"
                className={staffDrawerFieldClassName}
              />
            </div>
          ) : isStaffFixedPayType(payType) ? (
            <div className="space-y-2">
              <Label>{staffFixedPayInputLabel(payType)}</Label>
              <Input
                value={fixed}
                onChange={(e) => setFixed(e.target.value)}
                inputMode="decimal"
                className={staffDrawerFieldClassName}
              />
            </div>
          ) : null}
          </DrawerFormSection>

          <DrawerFormSection title="Arbeitszeit & Urlaub" contentPadding={5}>
          <div className="space-y-2">
            <Label>Urlaubstage pro Jahr</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={vacationDays}
              onChange={(e) => setVacationDays(e.target.value)}
              placeholder="z. B. 30"
              className={staffDrawerFieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label>Soll-Wochenstunden</Label>
            <Input
              value={targetWeeklyHours}
              onChange={(e) => setTargetWeeklyHours(e.target.value)}
              inputMode="decimal"
              placeholder="z. B. 40"
              className={staffDrawerFieldClassName}
            />
            <p className="text-xs text-muted-foreground">
              Wird im Schichtplan zum Abgleich der geplanten Stunden genutzt.
            </p>
          </div>
          </DrawerFormSection>

          <DrawerFormSection title="Notiz" contentPadding={5}>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Interne Notiz zum Vertrag …"
              rows={3}
              className={staffDrawerFieldClassName}
            />
          </DrawerFormSection>

          {editId ? (
            <DrawerFormSection title="Protokoll" contentPadding={5}>
              {logLoading ? (
                <p className="text-sm text-muted-foreground">Wird geladen …</p>
              ) : logEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Einträge — Änderungen erscheinen nach dem Speichern.
                </p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border/40 bg-muted/15 p-3">
                  {logEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="border-b border-border/30 pb-2 text-sm last:border-0 last:pb-0"
                    >
                      <p className="font-medium">
                        {entry.action === "created"
                          ? "Angelegt"
                          : "Geändert"}
                        {" · "}
                        <span className="font-normal text-muted-foreground">
                          {whenFmt.format(new Date(entry.created_at))}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatStaffContractLogActorLabel(entry.details)}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed">
                        {entry.details.summary ??
                          formatStaffContractLogSummary(
                            entry.action,
                            entry.details.changes ?? [],
                          )}
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
          submitType="button"
          onSubmit={() => void save()}
          submitPending={pending}
          showDelete={!!editId}
          onDelete={() => setConfirmDelete(true)}
        />
      </DrawerContent>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Vertrag löschen?"
        description={
          contract
            ? `Start ${formatStaffContractDateDe(contract.valid_from)}, Ende ${formatStaffContractEndDe(contract.valid_to)} — dieser Vertrag wird dauerhaft entfernt.`
            : "Dieser Vertrag wird dauerhaft entfernt."
        }
        confirmLabel="Löschen"
        destructive
        onConfirm={async () => {
          if (!editId) return;
          const ok = await deleteStaffContract(editId);
          if (!ok) {
            toast.error("Vertrag konnte nicht gelöscht werden.");
            throw new Error("delete failed");
          }
          toast.success("Vertrag gelöscht");
          setConfirmDelete(false);
          onDeleted();
          onOpenChange(false);
        }}
      />

      <CategoryDrawer
        open={employmentCreateOpen}
        onOpenChange={setEmploymentCreateOpen}
        mode="create"
        labels={EMPLOYMENT_CREATE_DRAWER_LABELS}
        onSave={(payload) => {
          void (async () => {
            const created = await onAddEmploymentType(
              payload.name,
              payload.active ?? true,
            );
            if (created?.id) setEmploymentTypeId(created.id);
          })();
        }}
      />
    </Drawer>
  );
}
