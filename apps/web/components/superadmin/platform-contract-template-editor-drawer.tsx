"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StaffContractPlaceholderReference } from "@/components/staff/staff-contract-placeholder-reference";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { COUNTRIES_REFERENCE_FALLBACK } from "@/lib/constants/countries";
import {
  bumpSuperadminPlatformContractTemplateVersion,
  deleteSuperadminPlatformContractTemplate,
  fetchSuperadminPlatformContractTemplate,
  saveSuperadminPlatformContractTemplate,
} from "@/lib/superadmin/platform-contract-templates-api";
import {
  PLATFORM_EMPLOYMENT_LEGACY_KEYS,
  PLATFORM_EMPLOYMENT_LEGACY_LABELS,
  type PlatformEmploymentLegacyKey,
  type PlatformStaffContractTemplateInput,
} from "@/lib/types/platform-contract-templates";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

type ParagraphDraft = {
  clientId: string;
  heading: string;
  body: string;
};

function newParagraphDraft(): ParagraphDraft {
  return {
    clientId:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `p-${Date.now()}`,
    heading: "",
    body: "",
  };
}

export function PlatformContractTemplateEditorDrawer({
  open,
  onOpenChange,
  templateId,
  defaultCountryCode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
  defaultCountryCode: string;
  onSaved: () => void;
}) {
  const isEdit = Boolean(templateId);
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [employmentLegacyKey, setEmploymentLegacyKey] =
    useState<PlatformEmploymentLegacyKey>("full_time");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Arbeitsvertrag");
  const [legalNotice, setLegalNotice] = useState("");
  const [version, setVersion] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [paragraphs, setParagraphs] = useState<ParagraphDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const activeFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setCountryCode(defaultCountryCode);
    if (!templateId) {
      setEmploymentLegacyKey("full_time");
      setName("");
      setTitle("Arbeitsvertrag — {{mitarbeiter.name}}");
      setLegalNotice("");
      setVersion(1);
      setIsActive(true);
      setParagraphs([newParagraphDraft()]);
      return;
    }

    let cancel = false;
    setLoading(true);
    void (async () => {
      const result = await fetchSuperadminPlatformContractTemplate(templateId);
      if (cancel) return;
      setLoading(false);
      if (!result.ok) {
        toast.error("Vorlage konnte nicht geladen werden.");
        return;
      }
      const data = result.template;
      setCountryCode(data.countryCode);
      setEmploymentLegacyKey(data.employmentLegacyKey);
      setName(data.name);
      setTitle(data.title);
      setLegalNotice(data.legalNotice ?? "");
      setVersion(data.version);
      setIsActive(data.isActive);
      setParagraphs(
        (data.paragraphs?.length ?? 0) > 0
          ? data.paragraphs!.map((p) => ({
              clientId: p.id,
              heading: p.heading ?? "",
              body: p.body,
            }))
          : [newParagraphDraft()],
      );
    })();

    return () => {
      cancel = true;
    };
  }, [open, templateId, defaultCountryCode]);

  const buildInput = useCallback((): PlatformStaffContractTemplateInput => {
    return {
      countryCode,
      employmentLegacyKey,
      name,
      title,
      legalNotice: legalNotice.trim() || null,
      version,
      isActive,
      paragraphs: paragraphs.map((p) => ({
        heading: p.heading,
        body: p.body,
      })),
    };
  }, [
    countryCode,
    employmentLegacyKey,
    name,
    title,
    legalNotice,
    version,
    isActive,
    paragraphs,
  ]);

  const insertPlaceholder = useCallback((token: string) => {
    const el = activeFieldRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const nextValue = el.value.slice(0, start) + token + el.value.slice(end);
    if (el.dataset.field === "title") setTitle(nextValue);
    else if (el.dataset.paragraphClientId) {
      const clientId = el.dataset.paragraphClientId;
      setParagraphs((prev) =>
        prev.map((p) =>
          p.clientId === clientId
            ? {
                ...p,
                ...(el.dataset.fieldPart === "heading"
                  ? { heading: nextValue }
                  : { body: nextValue }),
              }
            : p,
        ),
      );
    }
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }, []);

  const save = async () => {
    setPending(true);
    const result = await saveSuperadminPlatformContractTemplate(
      buildInput(),
      templateId,
    );
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Vorlage gespeichert." : "Vorlage angelegt.");
    onSaved();
    onOpenChange(false);
  };

  const bumpVersion = async () => {
    if (!templateId) return;
    setPending(true);
    const result = await bumpSuperadminPlatformContractTemplateVersion(templateId);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setVersion((v) => v + 1);
    toast.success("Versionsnummer erhöht — Restaurants sehen „Update verfügbar“.");
  };

  const countryOptions = useMemo(
    () =>
      COUNTRIES_REFERENCE_FALLBACK.filter((c) =>
        ["DE", "AT", "CH", "FR"].includes(c.iso2),
      ),
    [],
  );

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent className={drawerContentClassName("overview")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              {isEdit ? "Plattform-Vorlage bearbeiten" : "Neue Plattform-Vorlage"}
            </DrawerTitle>
            <DrawerDescription className="text-base">
              Mustertexte pro Land — Restaurants importieren eine Kopie.
            </DrawerDescription>
          </DrawerHeader>

          <DrawerFormBody>
          <div className={drawerScrollAreaClassName(6)}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Laden …</p>
            ) : (
              <div className="space-y-6">
                <DrawerFormSection title="Zuordnung" contentPadding={5}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Land</Label>
                      <Select
                        value={countryCode}
                        items={Object.fromEntries(
                          countryOptions.map((c) => [c.iso2, c.name_de]),
                        )}
                        onValueChange={(v) => {
                          if (typeof v === "string") setCountryCode(v);
                        }}
                      >
                        <SelectTrigger
                          className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {countryOptions.map((c) => (
                            <SelectItem key={c.iso2} value={c.iso2}>
                              {c.name_de}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Beschäftigungsart</Label>
                      <Select
                        value={employmentLegacyKey}
                        items={Object.fromEntries(
                          PLATFORM_EMPLOYMENT_LEGACY_KEYS.map((k) => [
                            k,
                            PLATFORM_EMPLOYMENT_LEGACY_LABELS[k],
                          ]),
                        )}
                        onValueChange={(v) => {
                          if (typeof v === "string") {
                            setEmploymentLegacyKey(v as PlatformEmploymentLegacyKey);
                          }
                        }}
                      >
                        <SelectTrigger
                          className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORM_EMPLOYMENT_LEGACY_KEYS.map((k) => (
                            <SelectItem key={k} value={k}>
                              {PLATFORM_EMPLOYMENT_LEGACY_LABELS[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Interner Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={staffDrawerFieldClassName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vertragsüberschrift</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      data-field="title"
                      onFocus={(e) => {
                        activeFieldRef.current = e.currentTarget;
                      }}
                      className={staffDrawerFieldClassName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rechtshinweis</Label>
                    <Textarea
                      value={legalNotice}
                      onChange={(e) => setLegalNotice(e.target.value)}
                      rows={2}
                      className={staffDrawerFieldClassName}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-muted/15 px-3 py-2.5">
                    <div>
                      <Label>Aktiv</Label>
                      <p className="text-xs text-muted-foreground">
                        Version {version} — nur aktive Vorlagen sind importierbar.
                      </p>
                    </div>
                    <Switch checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
                  </div>
                  {isEdit ? (
                    <Button type="button" variant="outline" disabled={pending} onClick={() => void bumpVersion()}>
                      Version erhöhen (Update-Hinweis)
                    </Button>
                  ) : null}
                </DrawerFormSection>

                <DrawerFormSection title="Paragraphen" contentPadding={5}>
                  <div className="mb-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setParagraphs((p) => [...p, newParagraphDraft()])}
                    >
                      <Plus className="size-3.5" />
                      Paragraph
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {paragraphs.map((p) => (
                      <div
                        key={p.clientId}
                        className="space-y-2 rounded-xl border border-border/40 p-3"
                      >
                        <Input
                          value={p.heading}
                          onChange={(e) =>
                            setParagraphs((prev) =>
                              prev.map((row) =>
                                row.clientId === p.clientId
                                  ? { ...row, heading: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          data-paragraph-client-id={p.clientId}
                          data-field-part="heading"
                          onFocus={(e) => {
                            activeFieldRef.current = e.currentTarget;
                          }}
                          placeholder="Überschrift (optional)"
                          className={staffDrawerFieldClassName}
                        />
                        <Textarea
                          value={p.body}
                          onChange={(e) =>
                            setParagraphs((prev) =>
                              prev.map((row) =>
                                row.clientId === p.clientId
                                  ? { ...row, body: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          data-paragraph-client-id={p.clientId}
                          data-field-part="body"
                          onFocus={(e) => {
                            activeFieldRef.current = e.currentTarget;
                          }}
                          rows={5}
                          className={staffDrawerFieldClassName}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() =>
                            setParagraphs((prev) =>
                              prev.length <= 1
                                ? prev
                                : prev.filter((row) => row.clientId !== p.clientId),
                            )
                          }
                        >
                          <Trash2 className="size-3.5" />
                          Entfernen
                        </Button>
                      </div>
                    ))}
                  </div>
                  <StaffContractPlaceholderReference
                    className="mt-4"
                    onInsert={insertPlaceholder}
                  />
                </DrawerFormSection>
              </div>
            )}
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitLabel={isEdit ? "Speichern" : "Anlegen"}
            submitType="button"
            onSubmit={() => void save()}
            submitDisabled={pending || loading || !name.trim()}
            submitPending={pending}
            showDelete={isEdit}
            onDelete={() => setConfirmDelete(true)}
            deleteLabel="Plattform-Vorlage löschen"
          />
          </DrawerFormBody>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Plattform-Vorlage löschen?"
        description="Restaurants behalten importierte Kopien — die Bibliotheks-Vorlage entfällt."
        confirmLabel="Löschen"
        onConfirm={async () => {
          if (!templateId) return;
          const result = await deleteSuperadminPlatformContractTemplate(templateId);
          if (!result.ok) {
            toast.error(result.error);
            throw new Error("delete failed");
          }
          toast.success("Vorlage gelöscht.");
          onSaved();
          onOpenChange(false);
        }}
      />
    </>
  );
}
