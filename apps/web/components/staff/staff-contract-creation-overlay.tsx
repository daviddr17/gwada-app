"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AppFullscreenOverlay,
  appFullscreenOverlayScrollClassName,
} from "@/components/ui/app-fullscreen-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/ui/signature-pad";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { cn } from "@/lib/utils";
import type { StaffContractFormPayload } from "@/lib/staff/staff-contract-form-utils";
import {
  buildStaffContractPlaceholderFields,
  extractStaffContractPlaceholderKeys,
  groupStaffContractPlaceholderFields,
  listMissingStaffContractFields,
  replaceStaffContractPlaceholders,
  resolveStaffContractPlaceholderValue,
  staffContractPlaceholderValuesMap,
} from "@/lib/staff/staff-contract-placeholder-resolver";
import { submitStaffContractDigitalComplete, submitStaffContractPrepare } from "@/lib/staff/staff-contract-digital-api";
import { notifyStaffContractsUpdated } from "@/lib/staff/staff-contract-events";
import { trackDashboardBusyOperation } from "@/lib/uploads/dashboard-busy-operation";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";
import {
  loadStaffContractTemplateWithParagraphs,
  loadStaffContractTemplates,
  type StaffContractTemplateWithParagraphs,
} from "@/lib/supabase/staff-contract-templates-db";
import { listMissingEmployerLegalFields } from "@/lib/staff/staff-contract-employer-check";
import type { RestaurantProfile } from "@/lib/types/restaurant";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import type { StaffContractBodySnapshot } from "@/lib/types/staff-contract-templates";

type ParagraphDraft = {
  heading: string;
  body: string;
};

export type StaffContractOverlayMode = "create" | "sign";

export type StaffContractOverlayOutcome =
  | "prepared"
  | "signed"
  | "pending_employee";

type StaffContractCreationOverlayProps = {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  staff: RestaurantStaffRow;
  restaurant: RestaurantProfile;
  contractId?: string | null;
  contractPayload: StaffContractFormPayload;
  initialSnapshot?: StaffContractBodySnapshot | null;
  onCompleted: (outcome: StaffContractOverlayOutcome) => void;
  onOpenTemplateManager?: (employmentTypeId: string) => void;
  /** Zweistufige Unterzeichnung: nur AG-Unterschrift, MA unterschreibt im Profil. */
  twoStepSigningEnabled?: boolean;
  /** create: Vorlage ausfüllen; sign: vorbereiteten Vertrag vor Ort unterschreiben. */
  overlayMode?: StaffContractOverlayMode;
};

function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function StaffContractCreationOverlay({
  open,
  onClose,
  restaurantId,
  staff,
  restaurant,
  contractId,
  contractPayload,
  initialSnapshot,
  onCompleted,
  onOpenTemplateManager,
  twoStepSigningEnabled = false,
  overlayMode = "create",
}: StaffContractCreationOverlayProps) {
  const signOnly = overlayMode === "sign";
  const { resolvedFullName, isHydrated: profileHydrated } =
    usePersonalProfileNames();
  const employmentTypeId = contractPayload.employment_type_id ?? "";

  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; title: string }>
  >([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [templateLoading, setTemplateLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [originalParagraphs, setOriginalParagraphs] = useState<ParagraphDraft[]>(
    [],
  );
  const [paragraphs, setParagraphs] = useState<ParagraphDraft[]>([]);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string>>(
    {},
  );
  const [employerName, setEmployerName] = useState("");
  const [employeeName, setEmployeeName] = useState(
    [staff.given_name, staff.family_name].filter(Boolean).join(" ").trim(),
  );
  const [employerSignature, setEmployerSignature] = useState<string | null>(
    null,
  );
  const [employeeSignature, setEmployeeSignature] = useState<string | null>(
    null,
  );
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmMissingFields, setConfirmMissingFields] = useState(false);
  const [confirmEmployerFields, setConfirmEmployerFields] = useState(false);
  const [acknowledgedMissingFields, setAcknowledgedMissingFields] = useState(false);
  const [acknowledgedEmployerFields, setAcknowledgedEmployerFields] = useState(false);
  const [confirmIntent, setConfirmIntent] = useState<"complete" | "prepare">(
    "complete",
  );

  const placeholderFields = useMemo(
    () =>
      buildStaffContractPlaceholderFields({
        staff,
        contract: contractPayload,
        restaurant,
        actingUserFullName:
          employerName.trim() ||
          (resolvedFullName !== "Nutzer" ? resolvedFullName : ""),
      }),
    [staff, contractPayload, restaurant, employerName, resolvedFullName],
  );

  const usedPlaceholderKeys = useMemo(
    () =>
      extractStaffContractPlaceholderKeys(
        originalTitle,
        ...originalParagraphs.flatMap((p) => [p.heading, p.body]),
      ),
    [originalTitle, originalParagraphs],
  );

  const groupedPlaceholderFields = useMemo(
    () =>
      groupStaffContractPlaceholderFields(
        usedPlaceholderKeys,
        placeholderFields,
        contractPayload.pay_type,
      ),
    [usedPlaceholderKeys, placeholderFields, contractPayload.pay_type],
  );

  const missingFields = useMemo(
    () =>
      listMissingStaffContractFields(placeholderFields, fieldOverrides, {
        onlyKeys: usedPlaceholderKeys,
        payType: contractPayload.pay_type,
      }),
    [
      placeholderFields,
      fieldOverrides,
      usedPlaceholderKeys,
      contractPayload.pay_type,
    ],
  );

  const missingEmployerFields = useMemo(
    () => listMissingEmployerLegalFields(restaurant),
    [restaurant],
  );

  const staffCanonicalName = useMemo(
    () =>
      [staff.given_name, staff.family_name].filter(Boolean).join(" ").trim(),
    [staff.given_name, staff.family_name],
  );

  const employeeNameMismatch = useMemo(
    () =>
      Boolean(staffCanonicalName) &&
      normalizePersonName(employeeName) !== normalizePersonName(staffCanonicalName),
    [employeeName, staffCanonicalName],
  );

  const applyTemplate = useCallback(
    (template: StaffContractTemplateWithParagraphs) => {
      const originals = template.paragraphs.map((p) => ({
        heading: p.heading ?? "",
        body: p.body,
      }));
      setOriginalParagraphs(originals);
      const resolvedTitle = replaceStaffContractPlaceholders(
        template.title.trim(),
        placeholderFields,
        fieldOverrides,
      );
      setOriginalTitle(template.title.trim());
      setTitle(resolvedTitle);
      setParagraphs(
        originals.map((p) => ({
          heading: replaceStaffContractPlaceholders(
            p.heading,
            placeholderFields,
            fieldOverrides,
          ),
          body: replaceStaffContractPlaceholders(
            p.body,
            placeholderFields,
            fieldOverrides,
          ),
        })),
      );
    },
    [placeholderFields, fieldOverrides],
  );

  const loadTemplateById = useCallback(
    async (id: string) => {
      setTemplateLoading(true);
      const { data, error } = await loadStaffContractTemplateWithParagraphs(id);
      setTemplateLoading(false);
      if (error || !data) {
        toast.error("Mustervorlage konnte nicht geladen werden.");
        return;
      }
      applyTemplate(data);
    },
    [applyTemplate],
  );

  useEffect(() => {
    if (!open) return;
    setAcknowledgedMissingFields(false);
    setAcknowledgedEmployerFields(false);
    setConsentAccepted(false);
    setEmployerSignature(null);
    setEmployeeSignature(null);

    if (initialSnapshot) {
      setTemplateId(initialSnapshot.template_id ?? "");
      setOriginalTitle(initialSnapshot.title);
      setTitle(initialSnapshot.title);
      const drafts = initialSnapshot.paragraphs.map((p) => ({
        heading: p.heading ?? "",
        body: p.body,
      }));
      setOriginalParagraphs(drafts);
      setParagraphs(drafts);
      const snapshotPlaceholders = initialSnapshot.placeholders ?? {};
      setFieldOverrides(snapshotPlaceholders);
      const snapshotCreator =
        snapshotPlaceholders["arbeitgeber.erstellt_von"]?.trim() ?? "";
      if (snapshotCreator) setEmployerName(snapshotCreator);
      return;
    }

    void (async () => {
      setTemplatesLoading(true);
      const { data } = await loadStaffContractTemplates(
        restaurantId,
        employmentTypeId,
      );
      setTemplatesLoading(false);
      const active = data.filter((t) => t.is_active);
      setTemplates(active.map((t) => ({ id: t.id, name: t.name, title: t.title })));
      if (active.length > 0) {
        const firstId = active[0]!.id;
        setTemplateId(firstId);
        await loadTemplateById(firstId);
      } else {
        setTemplateId("");
        setTitle("");
        setOriginalTitle("");
        setOriginalParagraphs([]);
        setParagraphs([]);
      }
    })();
  }, [open, restaurantId, employmentTypeId, initialSnapshot, loadTemplateById]);

  const reapplyPlaceholderFields = useCallback(
    (nextOverrides: Record<string, string>) => {
      setTitle(
        replaceStaffContractPlaceholders(
          originalTitle,
          placeholderFields,
          nextOverrides,
        ),
      );
      setParagraphs((prev) =>
        prev.map((p, index) => {
          const original = originalParagraphs[index];
          if (!original) return p;
          return {
            heading: replaceStaffContractPlaceholders(
              original.heading,
              placeholderFields,
              nextOverrides,
            ),
            body: replaceStaffContractPlaceholders(
              original.body,
              placeholderFields,
              nextOverrides,
            ),
          };
        }),
      );
    },
    [originalTitle, originalParagraphs, placeholderFields],
  );

  useEffect(() => {
    if (!open || initialSnapshot || !profileHydrated) return;
    const creatorName =
      resolvedFullName.trim() && resolvedFullName !== "Nutzer"
        ? resolvedFullName.trim()
        : "";
    if (!creatorName || fieldOverrides["arbeitgeber.erstellt_von"]?.trim()) return;
    if (originalParagraphs.length === 0) return;

    const next = { ...fieldOverrides, "arbeitgeber.erstellt_von": creatorName };
    setEmployerName((prev) => prev.trim() || creatorName);
    setFieldOverrides(next);
    reapplyPlaceholderFields(next);
  }, [
    open,
    initialSnapshot,
    profileHydrated,
    resolvedFullName,
    originalParagraphs.length,
    fieldOverrides,
    reapplyPlaceholderFields,
  ]);

  const handleFieldOverride = (key: string, value: string) => {
    const next = { ...fieldOverrides, [key]: value };
    setFieldOverrides(next);
    reapplyPlaceholderFields(next);
  };

  const handleEmployerNameChange = (value: string) => {
    setEmployerName(value);
    handleFieldOverride("arbeitgeber.erstellt_von", value);
  };

  const updateParagraph = (
    index: number,
    patch: Partial<ParagraphDraft>,
  ) => {
    setParagraphs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, ...patch };
      return next;
    });
    setOriginalParagraphs((orig) => {
      const copy = [...orig];
      const row = copy[index] ?? { heading: "", body: "" };
      copy[index] = { ...row, ...patch };
      return copy;
    });
  };

  const removeParagraph = (index: number) => {
    setParagraphs((prev) => prev.filter((_, i) => i !== index));
    setOriginalParagraphs((orig) => orig.filter((_, i) => i !== index));
  };

  const addParagraph = () => {
    const empty = { heading: "", body: "" };
    setParagraphs((prev) => [...prev, empty]);
    setOriginalParagraphs((orig) => [...orig, empty]);
  };

  const buildBodySnapshot = (): StaffContractBodySnapshot => ({
    template_id: templateId || null,
    template_name: templates.find((t) => t.id === templateId)?.name ?? null,
    title: title.trim(),
    paragraphs: paragraphs.map((p) => ({
      heading: p.heading.trim() || null,
      body: p.body,
    })),
    placeholders: staffContractPlaceholderValuesMap(
      placeholderFields,
      fieldOverrides,
    ),
  });

  const validateContractText = (): boolean => {
    if (!title.trim()) {
      toast.error("Bitte einen Vertragstitel angeben.");
      return false;
    }
    if (paragraphs.every((p) => !p.body.trim())) {
      toast.error("Der Vertrag enthält keinen Text.");
      return false;
    }
    return true;
  };

  const submitPrepare = async () => {
    if (!validateContractText()) return;

    if (missingEmployerFields.length > 0 && !acknowledgedEmployerFields) {
      setConfirmIntent("prepare");
      setConfirmEmployerFields(true);
      return;
    }

    if (missingFields.length > 0 && !acknowledgedMissingFields) {
      setConfirmIntent("prepare");
      setConfirmMissingFields(true);
      return;
    }

    setPending(true);
    try {
      const result = await trackDashboardBusyOperation(
        "Entwurf wird gespeichert …",
        () =>
          submitStaffContractPrepare({
            restaurantId,
            staffId: staff.id,
            contractId,
            contractFields: contractPayload,
            bodySnapshot: buildBodySnapshot(),
          }),
      );

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.revised
          ? "Entwurf aktualisiert."
          : "Entwurf gespeichert — Unterschrift kann vor Ort erfolgen.",
      );
      notifyStaffContractsUpdated();
      onCompleted("prepared");
      onClose();
    } finally {
      setPending(false);
    }
  };

  const submitComplete = async () => {
    const bodySnapshot = buildBodySnapshot();
    setPending(true);
    try {
      const result = await trackDashboardBusyOperation(
        "Vertrag wird erstellt …",
        () =>
          submitStaffContractDigitalComplete({
            restaurantId,
            staffId: staff.id,
            contractId,
            contractFields: contractPayload,
            bodySnapshot,
            consentAccepted: true,
            signatureEmployer: {
              signer_name: employerName.trim(),
              signature_data_url: employerSignature!,
            },
            ...(twoStepSigningEnabled
              ? { employerOnly: true }
              : {
                  signatureEmployee: {
                    signer_name: employeeName.trim(),
                    signature_data_url: employeeSignature!,
                  },
                }),
          }),
      );

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.pendingEmployeeSignature
          ? "Arbeitgeber-Unterschrift gespeichert — der Mitarbeiter wird benachrichtigt."
          : "Vertrag unterschrieben und PDF gespeichert.",
      );
      notifyStaffContractsUpdated();
      onCompleted(
        result.pendingEmployeeSignature ? "pending_employee" : "signed",
      );
      onClose();
    } finally {
      setPending(false);
    }
  };

  const handleComplete = async () => {
    if (!validateContractText()) return;
    if (!employerName.trim()) {
      toast.error("Bitte den Namen für die Arbeitgeber-Unterschrift angeben.");
      return;
    }
    if (!employerSignature) {
      toast.error("Die Unterschrift des Arbeitgebers ist erforderlich.");
      return;
    }
    if (!consentAccepted) {
      toast.error("Bitte die Einwilligung zur elektronischen Unterzeichnung bestätigen.");
      return;
    }
    if (!twoStepSigningEnabled) {
      if (!employeeName.trim()) {
        toast.error("Bitte den Namen für die Arbeitnehmer-Unterschrift angeben.");
        return;
      }
      if (!employeeSignature) {
        toast.error("Beide Unterschriften sind erforderlich.");
        return;
      }
    }

    if (missingEmployerFields.length > 0 && !acknowledgedEmployerFields) {
      setConfirmIntent("complete");
      setConfirmEmployerFields(true);
      return;
    }

    if (missingFields.length > 0 && !acknowledgedMissingFields) {
      setConfirmIntent("complete");
      setConfirmMissingFields(true);
      return;
    }

    await submitComplete();
  };

  const handlePrepare = async () => {
    await submitPrepare();
  };

  return (
    <>
      <AppFullscreenOverlay
        open={open}
        onClose={onClose}
        aria-label={signOnly ? "Vertrag unterschreiben" : "Vertragserstellung"}
        header={
          <div className="flex items-center gap-3 px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
              onClick={onClose}
              disabled={pending}
            >
              <ArrowLeft className="size-5" />
              <span className="sr-only">Zurück</span>
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">
                {signOnly ? "Vertrag unterschreiben" : "Vertragserstellung"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[staff.given_name, staff.family_name].filter(Boolean).join(" ")}
              </p>
            </div>
          </div>
        }
        footer={
          <div className="space-y-2 px-4 py-3">
            <Button
              type="button"
              className={cn("h-12 w-full", brandActionButtonRoundedClassName)}
              disabled={
                pending ||
                (!signOnly && templates.length === 0) ||
                !consentAccepted
              }
              onClick={() => void handleComplete()}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Wird abgeschlossen …
                </>
              ) : twoStepSigningEnabled ? (
                "Arbeitgeber-Unterschrift senden"
              ) : (
                "Vertrag abschließen"
              )}
            </Button>
            {!signOnly ? (
              <Button
                type="button"
                variant="secondary"
                className={cn("h-12 w-full", brandActionButtonRoundedClassName)}
                disabled={
                  pending || (!initialSnapshot && templates.length === 0)
                }
                onClick={() => void handlePrepare()}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Wird gespeichert …
                  </>
                ) : (
                  "Entwurf speichern"
                )}
              </Button>
            ) : null}
          </div>
        }
      >
        <div className={cn(appFullscreenOverlayScrollClassName, "px-4 py-4")}>
          {signOnly ? (
            <div className="mb-4 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm">
              Entwurf — Unterschriften können jetzt vor Ort gesetzt werden
              {twoStepSigningEnabled
                ? " (zuerst Arbeitgeber, Mitarbeiter optional im Profil)."
                : " (Arbeitgeber und Arbeitnehmer in dieser Ansicht)."}
            </div>
          ) : null}

          {missingEmployerFields.length > 0 ? (
            <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              Arbeitgeber-Stammdaten unvollständig (
              {missingEmployerFields.map((f) => f.label).join(", ")}). Bitte
              unter Einstellungen → Restaurant ergänzen — der Vertrag kann
              trotzdem abgeschlossen werden.
            </div>
          ) : null}

          <div className="mb-4 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            Die elektronischen Unterschriften sind keine qualifizierte
            elektronische Signatur (QES).
          </div>

          {twoStepSigningEnabled ? (
            <div className="mb-4 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm">
              Zweistufige Unterzeichnung: Du unterschreibst als Arbeitgeber. Der
              Mitarbeiter erhält eine Benachrichtigung und unterschreibt im
              Profil unter „Meine Dokumente“ — erst danach entsteht das PDF.
            </div>
          ) : null}

          <div className="space-y-4">
            {!signOnly ? (
            <div className="space-y-2">
              <Label>Mustervorlage</Label>
              <div className="flex gap-2">
                <Select
                  value={templateId || ""}
                  items={Object.fromEntries(
                    templates.map((t) => [t.id, t.name]),
                  )}
                  onValueChange={(v) => {
                    if (typeof v !== "string" || !v) return;
                    setTemplateId(v);
                    void loadTemplateById(v);
                  }}
                  disabled={templatesLoading || templateLoading || pending}
                >
                  <SelectTrigger
                    className={appSelectTriggerAccentCn(
                      cn(staffDrawerFieldClassName, "min-w-0 flex-1"),
                    )}
                  >
                    <SelectValue placeholder="Vorlage wählen">
                      {templates.find((t) => t.id === templateId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {onOpenTemplateManager && employmentTypeId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-xl px-0"
                    title="Mustervorlage anlegen oder importieren"
                    onClick={() => {
                      onOpenTemplateManager(employmentTypeId);
                      onClose();
                    }}
                  >
                    <FileText className="size-4" />
                  </Button>
                ) : null}
              </div>
              {templatesLoading ? (
                <p className="text-xs text-muted-foreground">Vorlagen werden geladen …</p>
              ) : templates.length === 0 ? (
                onOpenTemplateManager && employmentTypeId ? (
                  <button
                    type="button"
                    className="text-left text-xs text-amber-600 underline-offset-2 hover:underline"
                    onClick={() => {
                      onOpenTemplateManager(employmentTypeId);
                      onClose();
                    }}
                  >
                    Keine Mustervorlage für dieses Beschäftigungsverhältnis —
                    anlegen oder importieren.
                  </button>
                ) : (
                  <p className="text-xs text-amber-600">
                    Keine Mustervorlage für dieses Beschäftigungsverhältnis —
                    bitte zuerst anlegen oder importieren.
                  </p>
                )
              ) : null}
            </div>
            ) : null}

            <div className="space-y-2">
              <Label>Vertragstitel</Label>
              <Input
                value={title}
                onChange={(e) => {
                  const value = e.target.value;
                  setTitle(value);
                  setOriginalTitle(value);
                }}
                className={staffDrawerFieldClassName}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Platzhalter wie{" "}
                <code className="rounded bg-muted px-1">{`{{mitarbeiter.name}}`}</code>{" "}
                bleiben in Titel, Überschriften und Text beim Anpassen der
                Vertragsdaten dynamisch.
              </p>
            </div>

            {groupedPlaceholderFields.length > 0 ? (
              <div className="space-y-4 rounded-xl border border-border/50 p-4">
                <div>
                  <p className="text-sm font-medium">Vertragsdaten</p>
                  {missingFields.length > 0 ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Fehlend in dieser Vorlage:{" "}
                      {missingFields.map((f) => f.label).join(", ")}
                    </p>
                  ) : null}
                </div>
                {groupedPlaceholderFields.map((group) => (
                  <div key={group.id} className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      {group.items.map((field) => {
                        const value = resolveStaffContractPlaceholderValue(
                          placeholderFields,
                          fieldOverrides,
                          field.key,
                        );
                        const missing = !value.trim();
                        return (
                          <div key={field.key} className="min-w-0 space-y-1.5">
                            <Label className={cn(missing && "text-amber-600")}>
                              {field.label}
                              {missing ? " · fehlt" : ""}
                            </Label>
                            <Input
                              value={value}
                              onChange={(e) =>
                                handleFieldOverride(field.key, e.target.value)
                              }
                              className={cn(
                                staffDrawerFieldClassName,
                                missing && "border-amber-500/60 ring-amber-500/20",
                              )}
                              disabled={pending}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-4">
              <p className="text-sm font-medium">Vertragstext</p>
              <p className="text-xs text-muted-foreground">
                Bearbeiteter Text mit Platzhaltern wird bei geänderten
                Vertragsdaten automatisch neu aufgelöst.
              </p>
              {templateLoading ? (
                <p className="text-sm text-muted-foreground">Vorlage wird geladen …</p>
              ) : (
                <>
                  {paragraphs.map((p, index) => (
                    <div
                      key={index}
                      className="space-y-2 rounded-xl border border-border/40 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          value={p.heading}
                          onChange={(e) =>
                            updateParagraph(index, { heading: e.target.value })
                          }
                          placeholder="Abschnittsüberschrift (optional)"
                          className={cn(staffDrawerFieldClassName, "min-w-0 flex-1")}
                          disabled={pending}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 rounded-lg text-muted-foreground hover:text-destructive"
                          aria-label="Abschnitt entfernen"
                          disabled={pending}
                          onClick={() => removeParagraph(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <Textarea
                        value={p.body}
                        onChange={(e) =>
                          updateParagraph(index, { body: e.target.value })
                        }
                        rows={5}
                        className={staffDrawerFieldClassName}
                        disabled={pending}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className={modulePrimaryAddButtonFullWidthClassName}
                    disabled={pending || templateLoading}
                    onClick={addParagraph}
                  >
                    <Plus className="size-4" />
                    Abschnitt hinzufügen
                  </Button>
                </>
              )}
            </div>

            <div className={cn("grid min-w-0 gap-6", twoStepSigningEnabled ? "" : "md:grid-cols-2")}>
              <div className="space-y-3 rounded-xl border border-border/50 p-4">
                <p className="text-sm font-medium">Unterschrift Arbeitgeber</p>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={employerName}
                    onChange={(e) => handleEmployerNameChange(e.target.value)}
                    className={staffDrawerFieldClassName}
                    disabled={pending}
                  />
                  <p className="text-xs text-muted-foreground">
                    Aus deinem Profil — erscheint auch als „vertreten durch“ im
                    Vertragstext.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Unterschriftsdatum wird beim Abschluss serverseitig gesetzt.
                </p>
                <SignaturePad
                  value={employerSignature}
                  onChange={setEmployerSignature}
                  disabled={pending}
                  aria-label="Unterschrift Arbeitgeber"
                />
              </div>

              {!twoStepSigningEnabled ? (
              <div className="space-y-3 rounded-xl border border-border/50 p-4">
                <p className="text-sm font-medium">Unterschrift Arbeitnehmer</p>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className={staffDrawerFieldClassName}
                    disabled={pending}
                  />
                  {employeeNameMismatch ? (
                    <p className="text-xs text-amber-700">
                      Abweichung von den Mitarbeiter-Stammdaten (
                      {staffCanonicalName}) — bitte prüfen.
                    </p>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Unterschriftsdatum wird beim Abschluss serverseitig gesetzt.
                </p>
                <SignaturePad
                  value={employeeSignature}
                  onChange={setEmployeeSignature}
                  disabled={pending}
                  aria-label="Unterschrift Arbeitnehmer"
                />
              </div>
              ) : null}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/50 p-4">
              <Checkbox
                checked={consentAccepted}
                onCheckedChange={(v) => setConsentAccepted(v === true)}
                disabled={pending}
                className="mt-0.5"
              />
              <span className="text-sm leading-snug">
                {twoStepSigningEnabled
                  ? "Ich bestätige, dass Vertragstext und Stammdaten geprüft wurden und ich als Arbeitgeber in die elektronische Unterzeichnung ohne qualifizierte elektronische Signatur (QES) einwillige."
                  : "Ich bestätige, dass Vertragstext und Stammdaten geprüft wurden und beide Parteien in die elektronische Unterzeichnung ohne qualifizierte elektronische Signatur (QES) einwilligen."}
              </span>
            </label>
          </div>
        </div>
      </AppFullscreenOverlay>

      <ConfirmDialog
        open={confirmEmployerFields}
        onOpenChange={setConfirmEmployerFields}
        title="Arbeitgeber-Stammdaten unvollständig"
        description={`Fehlend: ${missingEmployerFields.map((f) => f.label).join(", ")}. Der Vertrag kann trotzdem erstellt werden — Platzhalter bleiben ggf. leer.`}
        confirmLabel="Dennoch erstellen"
        onConfirm={async () => {
          setAcknowledgedEmployerFields(true);
          setConfirmEmployerFields(false);
          if (missingFields.length > 0 && !acknowledgedMissingFields) {
            setConfirmMissingFields(true);
            return;
          }
          if (confirmIntent === "prepare") {
            await submitPrepare();
          } else {
            await submitComplete();
          }
        }}
      />

      <ConfirmDialog
        open={confirmMissingFields}
        onOpenChange={setConfirmMissingFields}
        title="Vertragsdaten unvollständig"
        description={`Fehlende Felder: ${missingFields.map((f) => f.label).join(", ")}. Sie können den Vertrag trotzdem abschließen — fehlende Werte erscheinen leer im PDF.`}
        confirmLabel={
          confirmIntent === "prepare" ? "Dennoch speichern" : "Dennoch abschließen"
        }
        onConfirm={async () => {
          setAcknowledgedMissingFields(true);
          setConfirmMissingFields(false);
          if (confirmIntent === "prepare") {
            await submitPrepare();
          } else {
            await submitComplete();
          }
        }}
      />
    </>
  );
}
