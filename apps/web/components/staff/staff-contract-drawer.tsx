"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeferredDrawerMount } from "@/lib/hooks/use-deferred-drawer-mount";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { CategoryDrawer } from "@/components/menu/category-drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
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
import { DatePickerField } from "@/components/ui/date-picker";
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
import type { StaffContractOverlayMode } from "@/components/staff/staff-contract-creation-overlay";
import { StaffContractPdfDownloadButton } from "@/components/staff/staff-contract-pdf-download-button";
import { StaffContractLogSignatures } from "@/components/staff/staff-contract-log-signatures";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { useDrawerFormKeyboardAssist } from "@/lib/hooks/use-drawer-form-keyboard-assist";
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
import {
  isStaffContractPrepared,
  isStaffContractExternal,
  isStaffContractSigned,
  isStaffContractTermsLocked,
  isStaffContractExternalMetadataEditable,
} from "@/lib/staff/staff-contract-status";
import { submitStaffContractExternal } from "@/lib/staff/staff-contract-external-api";
import {
  STAFF_CONTRACT_ATTACHMENT_ACCEPT,
  STAFF_CONTRACT_ATTACHMENT_LABEL,
  validateStaffContractAttachmentFile,
} from "@/lib/staff/validate-staff-contract-attachment-file";
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
import { cn } from "@/lib/utils";

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
  /** Erhöhen, wenn Mustervorlagen geändert wurden (z. B. neu angelegt). */
  templateRefreshKey?: number;
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
  templateRefreshKey = 0,
}: StaffContractDrawerProps) {
  const staffId = staff.id;
  const editId = contract?.id ?? null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { repositionInputs } = useDrawerFormKeyboardAssist({ open, scrollRef });
  const mountContent = useDeferredDrawerMount(open);
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
  const [overlayMode, setOverlayMode] = useState<StaffContractOverlayMode>("create");
  const [overlayPayload, setOverlayPayload] =
    useState<StaffContractFormPayload | null>(null);
  const [activeTemplateCount, setActiveTemplateCount] = useState(0);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [contractTwoStepSigning, setContractTwoStepSigning] = useState(false);
  const [externalContract, setExternalContract] = useState(false);
  const [externalPdfFile, setExternalPdfFile] = useState<File | null>(null);
  const [externalDocumentTitle, setExternalDocumentTitle] = useState("");
  const [externalSignedAt, setExternalSignedAt] = useState("");
  const [isExternalPdfDragOver, setIsExternalPdfDragOver] = useState(false);
  const externalPdfFileRef = useRef<HTMLInputElement>(null);
  const externalPdfDragDepthRef = useRef(0);

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

  const applyExternalPdfFile = useCallback((next: File | null) => {
    if (!next) {
      setExternalPdfFile(null);
      return;
    }
    const validationError = validateStaffContractAttachmentFile(next);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setExternalPdfFile(next);
    setExternalDocumentTitle((prev) => {
      if (prev.trim()) return prev;
      const base = next.name.replace(/\.[^.]+$/, "").trim();
      return base || prev;
    });
  }, []);

  const handleExternalPdfDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    externalPdfDragDepthRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsExternalPdfDragOver(true);
    }
  }, []);

  const handleExternalPdfDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    externalPdfDragDepthRef.current = Math.max(0, externalPdfDragDepthRef.current - 1);
    if (externalPdfDragDepthRef.current === 0) {
      setIsExternalPdfDragOver(false);
    }
  }, []);

  const handleExternalPdfDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  useEffect(() => {
    if (!open) return;
    setCreateContract(false);
    setCreationOverlayOpen(false);
    setOverlayPayload(null);
    setExternalPdfFile(null);
    externalPdfDragDepthRef.current = 0;
    setIsExternalPdfDragOver(false);
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
      setExternalContract(isStaffContractExternal(contract));
      setExternalSignedAt(contract.signed_at?.slice(0, 10) ?? "");
      setExternalDocumentTitle("");
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
      setExternalContract(false);
      setExternalSignedAt("");
      setExternalDocumentTitle("");
    }
  }, [open, contract]);

  useEffect(() => {
    if (externalContract) setCreateContract(false);
  }, [externalContract]);

  useEffect(() => {
    if (createContract) setExternalContract(false);
  }, [createContract]);

  useEffect(() => {
    if (externalContract) return;
    setExternalPdfFile(null);
    setExternalDocumentTitle("");
    setExternalSignedAt("");
    externalPdfDragDepthRef.current = 0;
    setIsExternalPdfDragOver(false);
  }, [externalContract]);

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
  }, [open, restaurantId, employmentTypeId, templateRefreshKey]);

  const contractIsExternal = isStaffContractExternal(contract);
  const contractPrepared = isStaffContractPrepared(contract);
  const contractIsSigned =
    isStaffContractSigned(contract) ||
    logEntries.some((entry) => entry.action === "signed");
  const contractTermsLocked = isStaffContractTermsLocked(contract);
  const externalMetadataEditable =
    isStaffContractExternalMetadataEditable(contract);
  const formFieldsDisabled = pending || contractTermsLocked;
  const missingPlatformDocument =
    Boolean(editId) &&
    !contract?.current_document_id &&
    !contract?.employee_signature_pending &&
    !contractIsExternal;
  const showContractAttachmentSection =
    externalContract ||
    contractIsExternal ||
    missingPlatformDocument;
  const showDigitalContractSection =
    missingPlatformDocument ||
    (Boolean(editId) &&
      !contractIsExternal &&
      !contract?.employee_signature_pending &&
      (contractPrepared ||
        contractIsSigned ||
        Boolean(contract?.current_document_id)));
  const attachmentUploadDisabled =
    Boolean(contract?.employee_signature_pending) ||
    (contractTermsLocked && Boolean(contract?.current_document_id));
  const useExternalSave =
    externalContract ||
    contractIsExternal ||
    (Boolean(editId) && Boolean(externalPdfFile) && !contract?.current_document_id);

  const handleExternalPdfDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      externalPdfDragDepthRef.current = 0;
      setIsExternalPdfDragOver(false);
      if (attachmentUploadDisabled) return;
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) applyExternalPdfFile(dropped);
    },
    [applyExternalPdfFile, attachmentUploadDisabled],
  );

  const canUsePlatformDigital =
    !contractIsExternal &&
    !contractIsSigned &&
    !contract?.employee_signature_pending;

  const showCreateTemplateAction =
    canUsePlatformDigital &&
    Boolean(employmentTypeId) &&
    !templatesLoading &&
    activeTemplateCount === 0 &&
    Boolean(onOpenTemplateManager) &&
    !contract?.signed_at &&
    !contract?.employee_signature_pending;

  const openTemplateManager = useCallback(() => {
    if (!employmentTypeId || !onOpenTemplateManager) return;
    onOpenTemplateManager(employmentTypeId);
  }, [employmentTypeId, onOpenTemplateManager]);

  const canCreateDigitalContract =
    canUsePlatformDigital &&
    Boolean(employmentTypeId) &&
    activeTemplateCount > 0 &&
    !templatesLoading &&
    !contractPrepared;

  const canSignPreparedContract =
    contractPrepared &&
    Boolean(employmentTypeId) &&
    !contract?.signed_at &&
    !contract?.employee_signature_pending;

  const canEditPreparedText =
    contractPrepared &&
    Boolean(employmentTypeId) &&
    activeTemplateCount > 0 &&
    !templatesLoading;

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
    if (action === "prepared") return "Entwurf gespeichert";
    if (action === "external_uploaded") return "Extern · Dokument";
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

  const saveExternal = async () => {
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

    const needsPdf = !editId && !externalPdfFile;
    const needsPdfOnEdit = Boolean(editId) && !contract?.current_document_id && !externalPdfFile;
    if (needsPdf || needsPdfOnEdit) {
      toast.error("Bitte eine PDF- oder Bilddatei auswählen.");
      return;
    }

    setPending(true);
    const result = await submitStaffContractExternal({
      restaurantId,
      staffId,
      contractId: editId,
      contractFields: validation.payload,
      file: externalPdfFile,
      documentTitle: externalDocumentTitle.trim() || undefined,
      signedAt: externalSignedAt.trim() || null,
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      externalPdfFile
        ? "Vertrag mit Dokument gespeichert."
        : "Vertrag aktualisiert.",
    );
    notifyStaffContractsUpdated();
    onSaved();
    onOpenChange(false);
  };

  const openContractCreation = (mode: StaffContractOverlayMode = "create") => {
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
    if (mode === "create" && !contractPrepared && !canCreateDigitalContract) {
      toast.error(
        "Für dieses Beschäftigungsverhältnis liegt keine Mustervorlage vor.",
      );
      return;
    }
    if (mode === "sign" && !canSignPreparedContract) {
      toast.error("Dieser Vertrag ist nicht zur Unterschrift bereit.");
      return;
    }
    setOverlayMode(mode);
    setOverlayPayload(validation.payload);
    setCreationOverlayOpen(true);
  };

  const handleFooterSubmit = () => {
    if (contractTermsLocked) {
      void save();
      return;
    }
    if (useExternalSave) {
      void saveExternal();
      return;
    }
    if (createContract) {
      openContractCreation("create");
      return;
    }
    void save();
  };

  return (
    <>
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && confirmDelete) return;
        onOpenChange(nextOpen);
      }}
      direction="bottom"
      repositionInputs={repositionInputs}
    >
      <DrawerContent className={drawerContentClassName("formStaff")}>
        <DrawerHeader className="min-w-0 shrink-0 overflow-x-hidden px-5 pt-2 pb-3 text-left">
          <DrawerTitle>
            {editId
              ? contractTermsLocked
                ? "Vertrag ansehen"
                : "Vertrag bearbeiten"
              : "Neuer Vertrag"}
          </DrawerTitle>
          {editId && staffName?.trim() ? (
            <DrawerDescription className="text-sm text-muted-foreground">
              {staffName.trim()}
            </DrawerDescription>
          ) : null}
        </DrawerHeader>
        {mountContent ? (
        <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className={staffDrawerScrollClassName}
          data-vaul-no-drag
        >
          {contractTermsLocked ? (
            <div className="mx-5 mb-4 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {contract?.employee_signature_pending
                ? "Vertragsdaten sind gesperrt — es fehlt noch die Unterschrift des Mitarbeiters."
                : isStaffContractExternal(contract)
                  ? "Externer Vertrag ist als unterschrieben markiert — Stammdaten und Dokument sind gesperrt. Nur interne Notizen können angepasst werden."
                  : "Vertragsdaten entsprechen dem unterschriebenen PDF und können nicht geändert werden. Interne Notizen sind weiterhin möglich."}
            </div>
          ) : externalMetadataEditable ? (
            <div className="mx-5 mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950">
              PDF ist hochgeladen — Stammdaten in Gwada können vom Dokument
              abweichen und sind noch änderbar. Nach dem Eintrag
              „Unterschrieben am“ werden alle Vertragsdaten gesperrt.
            </div>
          ) : null}
          <DrawerFormSection title="Laufzeit" contentPadding={5}>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="staff-contract-valid-from">Gültig von</Label>
              <DatePickerField
                id="staff-contract-valid-from"
                value={validFrom}
                onChange={(v) => setValidFrom(v ?? "")}
                fullWidth
                disabled={formFieldsDisabled}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="staff-contract-valid-to">Gültig bis</Label>
              <DatePickerField
                id="staff-contract-valid-to"
                value={validTo || null}
                onChange={(v) => setValidTo(v ?? "")}
                minYmd={validFrom || null}
                fullWidth
                disabled={formFieldsDisabled}
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
              disabled={formFieldsDisabled}
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
              disabled={formFieldsDisabled}
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
                disabled={formFieldsDisabled}
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
                disabled={formFieldsDisabled}
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
              disabled={formFieldsDisabled}
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
              disabled={formFieldsDisabled}
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

          {!editId ? (
            <DrawerFormSection title="Vertragsart" contentPadding={5}>
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
                    showCreateTemplateAction ? (
                      <button
                        type="button"
                        className="text-left text-xs text-amber-600 underline-offset-2 hover:underline"
                        onClick={openTemplateManager}
                      >
                        Keine Mustervorlage für dieses Beschäftigungsverhältnis —
                        anlegen oder importieren.
                      </button>
                    ) : (
                      <p className="text-xs text-amber-600">
                        Keine Mustervorlage für dieses Beschäftigungsverhältnis.
                      </p>
                    )
                  ) : null}
                </div>
                <Switch
                  checked={createContract}
                  onCheckedChange={setCreateContract}
                  disabled={!canCreateDigitalContract || pending}
                  aria-label="Vertrag erstellen"
                />
              </div>
              <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Externer Vertrag (Dokument)</p>
                  <p className="text-xs text-muted-foreground">
                    Vertrag existiert schon auf Papier — PDF oder Foto hochladen
                    und Stammdaten erfassen.
                  </p>
                </div>
                <Switch
                  checked={externalContract}
                  onCheckedChange={setExternalContract}
                  disabled={pending}
                  aria-label="Externer Vertrag"
                />
              </div>
            </DrawerFormSection>
          ) : null}

          {showDigitalContractSection ? (
          <DrawerFormSection title="Digitaler Vertrag" contentPadding={5}>
            {contract?.employee_signature_pending ? (
              <p className="mb-3 text-sm text-amber-700">
                Vom Arbeitgeber unterschrieben — wartet auf Unterschrift des
                Mitarbeiters im Profil. Für einen neuen Vertrag bitte diesen
                Vertrag beenden oder löschen und einen neuen anlegen.
              </p>
            ) : contractPrepared ? (
              <div className="mb-3 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Entwurf — Vertragstext ist gespeichert. Unterschrift kann vor
                  Ort am gemeinsamen Gerät erfolgen.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={pending || !canSignPreparedContract}
                    onClick={() => openContractCreation("sign")}
                  >
                    Jetzt unterschreiben
                  </Button>
                  {canEditPreparedText ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      disabled={pending}
                      onClick={() => openContractCreation("create")}
                    >
                      Text bearbeiten
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : contractIsSigned ? (
              <p className="mb-3 text-sm text-amber-700">
                Dieser Vertrag wurde bereits digital unterschrieben
                {contract?.signed_at
                  ? ` (${whenFmt.format(new Date(contract.signed_at))})`
                  : ""}
                . Für einen neuen Vertrag bitte diesen beenden oder löschen und
                einen neuen anlegen.
              </p>
            ) : missingPlatformDocument ? (
              <div className="mb-3 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Vertragsdaten sind gespeichert — Mustervorlage ausfüllen,
                  unterschreiben und als PDF in Dokumente speichern
                  {contractTwoStepSigning
                    ? " (Zweit-Schritt: Mitarbeiter unterschreibt im Profil)."
                    : "."}
                </p>
                {!employmentTypeId ? (
                  <p className="text-xs text-amber-600">
                    Bitte zuerst ein Beschäftigungsverhältnis wählen und
                    speichern.
                  </p>
                ) : templatesLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Mustervorlagen werden geprüft …
                  </p>
                ) : activeTemplateCount === 0 ? (
                  showCreateTemplateAction ? (
                    <button
                      type="button"
                      className="text-left text-xs text-amber-600 underline-offset-2 hover:underline"
                      onClick={openTemplateManager}
                    >
                      Keine Mustervorlage für dieses Beschäftigungsverhältnis —
                      anlegen oder importieren.
                    </button>
                  ) : (
                    <p className="text-xs text-amber-600">
                      Keine Mustervorlage für dieses Beschäftigungsverhältnis.
                    </p>
                  )
                ) : null}
                <Button
                  type="button"
                  className="w-full"
                  disabled={pending || !canCreateDigitalContract}
                  onClick={() => openContractCreation("create")}
                >
                  Vertrag aus Mustervorlage erstellen
                </Button>
              </div>
            ) : null}
            {contract?.current_document_id ? (
              <div className="mb-3">
                <StaffContractPdfDownloadButton
                  restaurantId={restaurantId}
                  documentId={contract.current_document_id}
                  documentTitle={
                    contract.contract_body_snapshot?.title?.trim() ||
                    undefined
                  }
                  fullWidth
                />
              </div>
            ) : null}
          </DrawerFormSection>
          ) : null}

          {showContractAttachmentSection ? (
            <DrawerFormSection
              title={
                externalContract || contractIsExternal
                  ? "Externer Vertrag (Dokument)"
                  : missingPlatformDocument
                    ? "Alternativ: externes Dokument"
                    : "Vertragsdokument"
              }
              contentPadding={5}
            >
              <p className="mb-3 text-sm text-muted-foreground">
                {externalContract || contractIsExternal
                  ? "Vertrag wurde außerhalb der Plattform erstellt — PDF oder Foto hier hochladen und Stammdaten pflegen. Keine digitale Unterschrift über Gwada."
                  : missingPlatformDocument
                    ? "Vertrag existiert schon auf Papier — PDF oder Foto hochladen statt der Mustervorlage in Gwada."
                    : "Noch kein Vertragsdokument hinterlegt — PDF oder Foto (z. B. Scan) nachträglich anhängen."}
              </p>
              {contract?.current_document_id ? (
                <div className="mb-3">
                  <StaffContractPdfDownloadButton
                    restaurantId={restaurantId}
                    documentId={contract.current_document_id}
                    documentTitle={
                      contract.contract_body_snapshot?.title?.trim() ||
                      undefined
                    }
                    fullWidth
                  />
                </div>
              ) : (
                <p className="mb-3 text-sm text-amber-700">
                  Noch kein Dokument angehängt.
                </p>
              )}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label id="external-contract-pdf-label">Datei</Label>
                  <input
                    ref={externalPdfFileRef}
                    id="external-contract-pdf"
                    type="file"
                    accept={STAFF_CONTRACT_ATTACHMENT_ACCEPT}
                    className="sr-only"
                    disabled={attachmentUploadDisabled}
                    onChange={(e) => {
                      applyExternalPdfFile(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                  <div
                    role="button"
                    tabIndex={attachmentUploadDisabled ? -1 : 0}
                    data-vaul-no-drag
                    aria-labelledby="external-contract-pdf-label"
                    aria-disabled={attachmentUploadDisabled}
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45",
                      attachmentUploadDisabled
                        ? "cursor-not-allowed border-border/40 bg-muted/15 opacity-60"
                        : isExternalPdfDragOver
                          ? "cursor-pointer border-accent bg-accent/10"
                          : "cursor-pointer border-border/60 bg-muted/25 hover:border-border hover:bg-muted/40",
                      externalPdfFile && "py-6",
                    )}
                    onClick={() => {
                      if (attachmentUploadDisabled) return;
                      externalPdfFileRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if (attachmentUploadDisabled) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        externalPdfFileRef.current?.click();
                      }
                    }}
                    onDragEnter={
                      attachmentUploadDisabled ? undefined : handleExternalPdfDragEnter
                    }
                    onDragLeave={
                      attachmentUploadDisabled ? undefined : handleExternalPdfDragLeave
                    }
                    onDragOver={
                      attachmentUploadDisabled ? undefined : handleExternalPdfDragOver
                    }
                    onDrop={attachmentUploadDisabled ? undefined : handleExternalPdfDrop}
                  >
                    <Upload
                      className={cn(
                        "size-8 shrink-0",
                        isExternalPdfDragOver ? "text-accent" : "text-muted-foreground",
                      )}
                      aria-hidden
                    />
                    {externalPdfFile ? (
                      <>
                        <span className="max-w-full truncate text-sm font-medium">
                          {externalPdfFile.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Klicken oder andere Datei hierher ziehen
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium">
                          {isExternalPdfDragOver
                            ? "Datei loslassen …"
                            : "Datei auswählen oder hierher ziehen"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {STAFF_CONTRACT_ATTACHMENT_LABEL}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {editId
                      ? "Optional — leer lassen, um das bestehende Dokument zu behalten."
                      : "Erforderlich beim Anlegen."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="external-document-title">
                    Dokumenttitel (optional)
                  </Label>
                  <Input
                    id="external-document-title"
                    value={externalDocumentTitle}
                    onChange={(e) => setExternalDocumentTitle(e.target.value)}
                    placeholder="z. B. Arbeitsvertrag Max Mustermann"
                    className={staffDrawerFieldClassName}
                    disabled={formFieldsDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unterschrieben am (optional)</Label>
                  <DatePickerField
                    value={externalSignedAt}
                    onChange={(ymd) => setExternalSignedAt(ymd ?? "")}
                    disabled={formFieldsDisabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Datum der Unterschrift auf dem Papiervertrag — nur zur
                    Dokumentation.
                  </p>
                </div>
              </div>
            </DrawerFormSection>
          ) : null}

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
          submitLabel={
            contractTermsLocked
              ? "Notiz speichern"
              : useExternalSave
                ? externalPdfFile || !editId
                  ? "Dokument speichern"
                  : "Speichern"
                : createContract
                  ? "Zur Vertragserstellung"
                  : "Speichern"
          }
          submitPending={pending}
          showDelete={!!editId}
          onDelete={() => setConfirmDelete(true)}
        />
        </div>
        ) : (
          <div className={staffDrawerScrollClassName} aria-hidden aria-busy />
        )}
      </DrawerContent>
    </Drawer>

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
            toast.error(
              result.error === "forbidden"
                ? "Keine Berechtigung zum Löschen."
                : "Vertrag konnte nicht gelöscht werden.",
            );
            throw new Error(result.error ?? "delete failed");
          }
          toast.success("Vertrag gelöscht");
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
          initialSnapshot={
            overlayMode === "sign" || contractPrepared
              ? contract?.contract_body_snapshot ?? null
              : null
          }
          overlayMode={overlayMode}
          onCompleted={(outcome) => {
            onSaved();
            setCreationOverlayOpen(false);
            if (outcome !== "prepared") {
              onOpenChange(false);
            }
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
    </>
  );
}
