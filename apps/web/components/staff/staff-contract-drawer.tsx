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
import { Switch } from "@/components/ui/switch";
import { StaffContractCreationOverlay } from "@/components/staff/staff-contract-creation-overlay";
import { StaffContractPdfDownloadButton } from "@/components/staff/staff-contract-pdf-download-button";
import { StaffContractVersionsList } from "@/components/staff/staff-contract-versions-list";
import { StaffContractLogSignatures } from "@/components/staff/staff-contract-log-signatures";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
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
} from "@/lib/staff/staff-contract-pay";
import {
  formatStaffContractDateDe,
  formatStaffContractEndDe,
} from "@/lib/staff/staff-contract-period";
import {
  validateStaffContractForm,
  type StaffContractFormPayload,
} from "@/lib/staff/staff-contract-form-utils";
import { loadStaffContractTemplates } from "@/lib/supabase/staff-contract-templates-db";
import { fetchStaffModuleSettings } from "@/lib/supabase/staff-module-settings-db";
import type { RestaurantProfile } from "@/lib/types/restaurant";
import {
  STAFF_CONTRACT_PAY_ITEMS,
  STAFF_CONTRACT_PAY_LABELS,
  STAFF_CONTRACT_PAY_TYPES,
} from "@/lib/types/staff";
import type {
  RestaurantStaffContractLogEntry,
  RestaurantStaffContractRow,
  RestaurantStaffRow,
  StaffContractPayType,
  StaffEmploymentTypeDefinition,
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
  staff: RestaurantStaffRow;
  staffName?: string | null;
  restaurant: RestaurantProfile;
  contract: RestaurantStaffContractRow | null;
  existingContracts: readonly RestaurantStaffContractRow[];
  employmentTypes: readonly StaffEmploymentTypeDefinition[];
  onAddEmploymentType: (
    name: string,
    active?: boolean,
  ) => Promise<{ id: string; name: string } | null>;
  onSaved: () => void;
  onDeleted: () => void;
  onOpenTemplateManager?: (employmentTypeId: string) => void;
};

export function StaffContractDrawer({
  open,
  onOpenChange,
  restaurantId,
  staff,
  staffName,
  restaurant,
  contract,
  existingContracts,
  employmentTypes,
  onAddEmploymentType,
  onSaved,
  onDeleted,
  onOpenTemplateManager,
}: StaffContractDrawerProps) {
  const staffId = staff.id;
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
  const [createContract, setCreateContract] = useState(false);
  const [creationOverlayOpen, setCreationOverlayOpen] = useState(false);
  const [overlayPayload, setOverlayPayload] =
    useState<StaffContractFormPayload | null>(null);
  const [activeTemplateCount, setActiveTemplateCount] = useState(0);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [contractTwoStepSigning, setContractTwoStepSigning] = useState(false);

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
    setCreateContract(false);
    setCreationOverlayOpen(false);
    setOverlayPayload(null);
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

  useEffect(() => {
    if (!open || !employmentTypeId) {
      setActiveTemplateCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      setTemplatesLoading(true);
      const { data } = await loadStaffContractTemplates(
        restaurantId,
        employmentTypeId,
      );
      if (cancelled) return;
      setTemplatesLoading(false);
      setActiveTemplateCount(data.filter((t) => t.is_active).length);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, restaurantId, employmentTypeId]);

  const canCreateDigitalContract =
    Boolean(employmentTypeId) && activeTemplateCount > 0 && !templatesLoading;

  const currentFormState = useMemo(
    () => ({
      validFrom,
      validTo,
      payType,
      hourly,
      fixed,
      employmentTypeId,
      vacationDays,
      targetWeeklyHours,
      note,
    }),
    [
      validFrom,
      validTo,
      payType,
      hourly,
      fixed,
      employmentTypeId,
      vacationDays,
      targetWeeklyHours,
      note,
    ],
  );

  const logActionLabel = (action: RestaurantStaffContractLogEntry["action"]) => {
    if (action === "created") return "Angelegt";
    if (action === "signed") return "Unterschrieben";
    if (action === "revised") return "Überarbeitet";
    if (action === "pdf_version") return "PDF-Version";
    if (action === "employer_signed") return "AG-Unterschrift";
    if (action === "employee_signed") return "MA-Unterschrift";
    return "Geändert";
  };

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
    if (!open || !restaurantId) return;
    let cancel = false;
    void (async () => {
      const { data } = await fetchStaffModuleSettings(restaurantId);
      if (cancel) return;
      setContractTwoStepSigning(data?.contract_two_step_signing ?? false);
    })();
    return () => {
      cancel = true;
    };
  }, [open, restaurantId]);

  useEffect(() => {
    if (!open || !editId) return;
    void reloadLog();
  }, [open, editId, reloadLog]);

  const save = async () => {
    const validation = validateStaffContractForm({
      form: currentFormState,
      employmentTypes,
      existingContracts,
      editId,
    });
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }

    setPending(true);
    const res = await upsertStaffContract(restaurantId, staffId, {
      id: editId ?? undefined,
      ...validation.payload,
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

    const changes = buildStaffContractChanges(
      contract,
      validation.payload,
      employmentTypes,
    );
    await insertStaffContractLogEntry(
      restaurantId,
      res.id,
      contract ? "updated" : "created",
      changes,
    );

    setPending(false);
    if (res.usedLegacyFields && validation.payload.target_weekly_minutes != null) {
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

  const openContractCreation = () => {
    const validation = validateStaffContractForm({
      form: currentFormState,
      employmentTypes,
      existingContracts,
      editId,
    });
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    if (!canCreateDigitalContract) {
      toast.error(
        "Für dieses Beschäftigungsverhältnis liegt keine Mustervorlage vor.",
      );
      return;
    }
    setOverlayPayload(validation.payload);
    setCreationOverlayOpen(true);
  };

  const handleFooterSubmit = () => {
    if (createContract) {
      openContractCreation();
      return;
    }
    void save();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("formStaff")}>
        <DrawerHeader className="min-w-0 shrink-0 overflow-x-hidden px-5 pt-2 pb-3 text-left">
          <DrawerTitle>
            {editId ? "Vertrag bearbeiten" : "Neuer Vertrag"}
          </DrawerTitle>
          {editId && staffName?.trim() ? (
            <DrawerDescription className="text-sm text-muted-foreground">
              {staffName.trim()}
            </DrawerDescription>
          ) : null}
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={staffDrawerScrollClassName}
          data-vaul-no-drag
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

          <DrawerFormSection title="Digitaler Vertrag" contentPadding={5}>
            {contract?.employee_signature_pending ? (
              <p className="mb-3 text-sm text-amber-700">
                Vom Arbeitgeber unterschrieben — wartet auf Unterschrift des
                Mitarbeiters im Profil.
              </p>
            ) : contract?.signed_at ? (
              <p className="mb-3 text-sm text-amber-700">
                Dieser Vertrag wurde bereits digital unterschrieben (
                {whenFmt.format(new Date(contract.signed_at))}).
              </p>
            ) : null}
            {contract?.current_document_id ? (
              <div className="mb-3 space-y-3">
                <StaffContractPdfDownloadButton
                  restaurantId={restaurantId}
                  documentId={contract.current_document_id}
                  fullWidth
                />
                <StaffContractVersionsList
                  restaurantId={restaurantId}
                  contractId={editId}
                />
              </div>
            ) : editId ? (
              <StaffContractVersionsList
                restaurantId={restaurantId}
                contractId={editId}
              />
            ) : null}
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Vertrag erstellen</p>
                <p className="text-xs text-muted-foreground">
                  Mustervorlage ausfüllen, unterschreiben und als PDF in
                  Dokumente speichern
                  {contractTwoStepSigning
                    ? " (Zweit-Schritt: Mitarbeiter unterschreibt im Profil)."
                    : "."}
                </p>
                {!employmentTypeId ? (
                  <p className="text-xs text-amber-600">
                    Bitte zuerst ein Beschäftigungsverhältnis wählen.
                  </p>
                ) : templatesLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Mustervorlagen werden geprüft …
                  </p>
                ) : activeTemplateCount === 0 ? (
                  <p className="text-xs text-amber-600">
                    Keine Mustervorlage für dieses Beschäftigungsverhältnis.
                  </p>
                ) : null}
              </div>
              <Switch
                checked={createContract}
                onCheckedChange={setCreateContract}
                disabled={!canCreateDigitalContract || pending}
                aria-label="Vertrag erstellen"
              />
            </div>
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
                        {logActionLabel(entry.action)}
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
                      {entry.details.pdfSha256 ? (
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          PDF SHA-256: {entry.details.pdfSha256}
                        </p>
                      ) : null}
                      {entry.action === "signed" ||
                      entry.action === "revised" ||
                      entry.action === "pdf_version" ||
                      entry.action === "employer_signed" ||
                      entry.action === "employee_signed" ? (
                        <StaffContractLogSignatures
                          restaurantId={restaurantId}
                          contractId={editId}
                          details={entry.details}
                        />
                      ) : null}
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
          onSubmit={handleFooterSubmit}
          submitLabel={createContract ? "Zur Vertragserstellung" : "Speichern"}
          submitPending={pending}
          showDelete={!!editId}
          onDelete={() => setConfirmDelete(true)}
        />
        </div>
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
          const result = await deleteStaffContract(restaurantId, editId);
          if (!result.ok) {
            toast.error("Vertrag konnte nicht gelöscht werden.");
            throw new Error(result.error ?? "delete failed");
          }
          toast.success("Vertrag gelöscht");
          setConfirmDelete(false);
          notifyStaffContractsUpdated();
          onDeleted();
          onOpenChange(false);
        }}
      />

      {overlayPayload && creationOverlayOpen ? (
        <StaffContractCreationOverlay
          open={creationOverlayOpen}
          onClose={() => setCreationOverlayOpen(false)}
          restaurantId={restaurantId}
          staff={staff}
          restaurant={restaurant}
          contractId={editId}
          contractPayload={overlayPayload}
          alreadySigned={Boolean(contract?.signed_at)}
          initialSnapshot={contract?.contract_body_snapshot ?? null}
          onCompleted={() => {
            onSaved();
            onOpenChange(false);
          }}
          onOpenTemplateManager={onOpenTemplateManager}
          twoStepSigningEnabled={contractTwoStepSigning}
        />
      ) : null}

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
