"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppFullscreenOverlay } from "@/components/ui/app-fullscreen-overlay";
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
import { cn } from "@/lib/utils";
import type { StaffContractFormPayload } from "@/lib/staff/staff-contract-form-utils";
import {
  buildStaffContractPlaceholderFields,
  listMissingStaffContractFields,
  replaceStaffContractPlaceholders,
  staffContractPlaceholderValuesMap,
} from "@/lib/staff/staff-contract-placeholder-resolver";
import { submitStaffContractDigitalComplete } from "@/lib/staff/staff-contract-digital-api";
import { notifyStaffContractsUpdated } from "@/lib/staff/staff-contract-events";
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

type StaffContractCreationOverlayProps = {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  staff: RestaurantStaffRow;
  restaurant: RestaurantProfile;
  contractId?: string | null;
  contractPayload: StaffContractFormPayload;
  alreadySigned?: boolean;
  initialSnapshot?: StaffContractBodySnapshot | null;
  onCompleted: () => void;
  onOpenTemplateManager?: (employmentTypeId: string) => void;
  /** Zweistufige Unterzeichnung: nur AG-Unterschrift, MA unterschreibt im Profil. */
  twoStepSigningEnabled?: boolean;
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
  alreadySigned = false,
  initialSnapshot,
  onCompleted,
  onOpenTemplateManager,
  twoStepSigningEnabled = false,
}: StaffContractCreationOverlayProps) {
  const employmentTypeId = contractPayload.employment_type_id ?? "";

  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; title: string }>
  >([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [templateLoading, setTemplateLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [originalParagraphs, setOriginalParagraphs] = useState<ParagraphDraft[]>(
    [],
  );
  const [paragraphs, setParagraphs] = useState<ParagraphDraft[]>([]);
  const [paragraphDirty, setParagraphDirty] = useState<boolean[]>([]);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string>>(
    {},
  );
  const [employerName, setEmployerName] = useState(
    restaurant.legalRepresentative?.trim() ||
      restaurant.legalName?.trim() ||
      restaurant.name?.trim() ||
      "",
  );
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
  const [confirmRevise, setConfirmRevise] = useState(false);
  const [reviseConfirmed, setReviseConfirmed] = useState(false);
  const [confirmMissingFields, setConfirmMissingFields] = useState(false);
  const [confirmEmployerFields, setConfirmEmployerFields] = useState(false);
  const [acknowledgedMissingFields, setAcknowledgedMissingFields] = useState(false);
  const [acknowledgedEmployerFields, setAcknowledgedEmployerFields] = useState(false);
  const [completeReviseFlag, setCompleteReviseFlag] = useState(false);

  const placeholderFields = useMemo(
    () =>
      buildStaffContractPlaceholderFields({
        staff,
        contract: contractPayload,
        restaurant,
      }),
    [staff, contractPayload, restaurant],
  );

  const missingFields = useMemo(
    () => listMissingStaffContractFields(placeholderFields, fieldOverrides),
    [placeholderFields, fieldOverrides],
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
      setParagraphDirty(originals.map(() => false));
      setTitle(template.title.trim());
      setParagraphs(
        originals.map((p) => ({
          heading: p.heading,
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
    setReviseConfirmed(false);
    setAcknowledgedMissingFields(false);
    setAcknowledgedEmployerFields(false);
    setConsentAccepted(false);
    setEmployerSignature(null);
    setEmployeeSignature(null);

    if (initialSnapshot) {
      setTemplateId(initialSnapshot.template_id ?? "");
      setTitle(initialSnapshot.title);
      const drafts = initialSnapshot.paragraphs.map((p) => ({
        heading: p.heading ?? "",
        body: p.body,
      }));
      setOriginalParagraphs(drafts);
      setParagraphs(drafts);
      setParagraphDirty(drafts.map(() => true));
      setFieldOverrides(initialSnapshot.placeholders ?? {});
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
        setOriginalParagraphs([]);
        setParagraphs([]);
        setParagraphDirty([]);
      }
    })();
  }, [open, restaurantId, employmentTypeId, initialSnapshot, loadTemplateById]);

  const reapplyFieldToParagraphs = useCallback(
    (nextOverrides: Record<string, string>) => {
      setParagraphs((prev) =>
        prev.map((p, index) => {
          if (paragraphDirty[index]) return p;
          const original = originalParagraphs[index];
          if (!original) return p;
          return {
            heading: p.heading,
            body: replaceStaffContractPlaceholders(
              original.body,
              placeholderFields,
              nextOverrides,
            ),
          };
        }),
      );
    },
    [originalParagraphs, paragraphDirty, placeholderFields],
  );

  const handleFieldOverride = (key: string, value: string) => {
    const next = { ...fieldOverrides, [key]: value };
    setFieldOverrides(next);
    reapplyFieldToParagraphs(next);
  };

  const submitComplete = async (revise = false) => {
    const bodySnapshot: StaffContractBodySnapshot = {
      template_id: templateId || null,
      template_name:
        templates.find((t) => t.id === templateId)?.name ?? null,
      title: title.trim(),
      paragraphs: paragraphs.map((p) => ({
        heading: p.heading.trim() || null,
        body: p.body,
      })),
      placeholders: staffContractPlaceholderValuesMap(
        placeholderFields,
        fieldOverrides,
      ),
    };

    setPending(true);
    const result = await submitStaffContractDigitalComplete({
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
      revise: alreadySigned || revise || reviseConfirmed,
    });
    setPending(false);

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
    onCompleted();
    onClose();
  };

  const handleComplete = async (revise = false) => {
    if (!title.trim()) {
      toast.error("Bitte einen Vertragstitel angeben.");
      return;
    }
    if (paragraphs.every((p) => !p.body.trim())) {
      toast.error("Der Vertrag enthält keinen Text.");
      return;
    }
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

    if (alreadySigned && !revise && !reviseConfirmed) {
      setCompleteReviseFlag(revise);
      setConfirmRevise(true);
      return;
    }

    if (missingEmployerFields.length > 0 && !acknowledgedEmployerFields) {
      setCompleteReviseFlag(revise);
      setConfirmEmployerFields(true);
      return;
    }

    if (missingFields.length > 0 && !acknowledgedMissingFields) {
      setCompleteReviseFlag(revise);
      setConfirmMissingFields(true);
      return;
    }

    await submitComplete(revise);
  };

  return (
    <>
      <AppFullscreenOverlay
        open={open}
        onClose={onClose}
        aria-label="Vertragserstellung"
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
              <p className="truncate text-base font-semibold">Vertragserstellung</p>
              <p className="truncate text-xs text-muted-foreground">
                {[staff.given_name, staff.family_name].filter(Boolean).join(" ")}
              </p>
            </div>
          </div>
        }
        footer={
          <div className="px-4 py-3">
            <Button
              type="button"
              className={cn("h-12 w-full", brandActionButtonRoundedClassName)}
              disabled={pending || templates.length === 0 || !consentAccepted}
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
          </div>
        }
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {missingEmployerFields.length > 0 ? (
            <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              Arbeitgeber-Stammdaten unvollständig (
              {missingEmployerFields.map((f) => f.label).join(", ")}). Bitte
              unter Einstellungen → Restaurant ergänzen — der Vertrag kann
              trotzdem abgeschlossen werden.
            </div>
          ) : null}
          {alreadySigned && !reviseConfirmed ? (
            <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              Dieser Vertrag wurde bereits digital unterschrieben. Beim Abschluss
              wird eine neue PDF-Version erstellt.
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
                    className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
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
                    className="shrink-0 rounded-xl"
                    title="Neues Muster erstellen"
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
                <p className="text-xs text-amber-600">
                  Keine Mustervorlage für dieses Beschäftigungsverhältnis — bitte zuerst
                  anlegen.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Vertragstitel</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={staffDrawerFieldClassName}
                disabled={pending}
              />
            </div>

            {missingFields.length > 0 || Object.keys(placeholderFields).length > 0 ? (
              <div className="space-y-3 rounded-xl border border-border/50 p-4">
                <p className="text-sm font-medium">Vertragsdaten</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.values(placeholderFields).map((field) => {
                    const value = fieldOverrides[field.key] ?? field.value;
                    const missing = !value.trim();
                    return (
                      <div key={field.key} className="space-y-1.5">
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
            ) : null}

            <div className="space-y-4">
              <p className="text-sm font-medium">Vertragstext</p>
              {templateLoading ? (
                <p className="text-sm text-muted-foreground">Vorlage wird geladen …</p>
              ) : (
                paragraphs.map((p, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-xl border border-border/40 p-3"
                  >
                    <Input
                      value={p.heading}
                      onChange={(e) => {
                        const next = [...paragraphs];
                        next[index] = { ...next[index]!, heading: e.target.value };
                        setParagraphs(next);
                        setParagraphDirty((d) => {
                          const copy = [...d];
                          copy[index] = true;
                          return copy;
                        });
                      }}
                      placeholder="Abschnittsüberschrift (optional)"
                      className={staffDrawerFieldClassName}
                      disabled={pending}
                    />
                    <Textarea
                      value={p.body}
                      onChange={(e) => {
                        const next = [...paragraphs];
                        next[index] = { ...next[index]!, body: e.target.value };
                        setParagraphs(next);
                        setParagraphDirty((d) => {
                          const copy = [...d];
                          copy[index] = true;
                          return copy;
                        });
                      }}
                      rows={5}
                      className={staffDrawerFieldClassName}
                      disabled={pending}
                    />
                  </div>
                ))
              )}
            </div>

            <div className={cn("grid gap-6", twoStepSigningEnabled ? "" : "md:grid-cols-2")}>
              <div className="space-y-3 rounded-xl border border-border/50 p-4">
                <p className="text-sm font-medium">Unterschrift Arbeitgeber</p>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={employerName}
                    onChange={(e) => setEmployerName(e.target.value)}
                    className={staffDrawerFieldClassName}
                    disabled={pending}
                  />
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
        open={confirmRevise}
        onOpenChange={setConfirmRevise}
        title="Vertrag erneut bearbeiten?"
        description="Der Vertrag wurde bereits unterschrieben. Beim Abschluss entsteht eine neue PDF-Version; die alte bleibt erhalten."
        confirmLabel="Trotzdem bearbeiten"
        onConfirm={async () => {
          setReviseConfirmed(true);
          setConfirmRevise(false);
          await handleComplete(true);
        }}
      />

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
          await submitComplete(completeReviseFlag);
        }}
      />

      <ConfirmDialog
        open={confirmMissingFields}
        onOpenChange={setConfirmMissingFields}
        title="Vertragsdaten unvollständig"
        description={`Fehlende Felder: ${missingFields.map((f) => f.label).join(", ")}. Sie können den Vertrag trotzdem abschließen — fehlende Werte erscheinen leer im PDF.`}
        confirmLabel="Dennoch abschließen"
        onConfirm={async () => {
          setAcknowledgedMissingFields(true);
          setConfirmMissingFields(false);
          await submitComplete(completeReviseFlag);
        }}
      />
    </>
  );
}
