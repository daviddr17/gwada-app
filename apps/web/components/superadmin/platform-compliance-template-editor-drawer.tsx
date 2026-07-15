"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { SearchableSelect } from "@/components/ui/combobox";
import { COUNTRIES_REFERENCE_FALLBACK } from "@/lib/constants/countries";
import { newComplianceItemId } from "@/lib/compliance/compliance-utils";
import {
  bumpSuperadminPlatformComplianceTemplateVersion,
  deleteSuperadminPlatformComplianceTemplate,
  fetchSuperadminPlatformComplianceTemplate,
  saveSuperadminPlatformComplianceTemplate,
} from "@/lib/superadmin/platform-compliance-templates-api";
import {
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_CATEGORY_LABELS,
  COMPLIANCE_FIELD_TYPE_LABELS,
  COMPLIANCE_FIELD_TYPES,
  COMPLIANCE_FREQUENCIES,
  COMPLIANCE_FREQUENCY_LABELS,
  type ComplianceCategory,
  type ComplianceChecklistItem,
  type ComplianceFieldType,
  type ComplianceFrequency,
} from "@/lib/types/compliance";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

const selectClass = appSelectTriggerAccentCn("h-11 w-full rounded-xl");

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
  return {
    id: newComplianceItemId(),
    label: "Feld",
    fieldType: "text",
    required: true,
  };
}

export function PlatformComplianceTemplateEditorDrawer({
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ComplianceCategory>("temperature");
  const [frequency, setFrequency] = useState<ComplianceFrequency>("daily");
  const [showOnDisplay, setShowOnDisplay] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [version, setVersion] = useState(1);
  const [items, setItems] = useState<ComplianceChecklistItem[]>([emptyItem("temperature")]);

  const countryOptions = useMemo(
    () =>
      COUNTRIES_REFERENCE_FALLBACK.filter((c) =>
        ["DE", "AT", "CH", "FR"].includes(c.iso2),
      ),
    [],
  );

  const resetCreate = useCallback(() => {
    setCountryCode(defaultCountryCode);
    setName("");
    setDescription("");
    setCategory("temperature");
    setFrequency("daily");
    setShowOnDisplay(true);
    setIsActive(true);
    setSortOrder(0);
    setVersion(1);
    setItems([emptyItem("temperature")]);
  }, [defaultCountryCode]);

  useEffect(() => {
    if (!open) return;
    if (!templateId) {
      resetCreate();
      return;
    }

    let cancel = false;
    setLoading(true);
    void (async () => {
      const result = await fetchSuperadminPlatformComplianceTemplate(templateId);
      if (cancel) return;
      setLoading(false);
      if (!result.ok) {
        toast.error("Vorlage konnte nicht geladen werden.");
        return;
      }
      const t = result.template;
      setCountryCode(t.countryCode);
      setName(t.name);
      setDescription(t.description ?? "");
      setCategory(t.category);
      setFrequency(t.frequency);
      setShowOnDisplay(t.showOnDisplay);
      setIsActive(t.isActive);
      setSortOrder(t.sortOrder);
      setVersion(t.version);
      setItems(t.items.length > 0 ? t.items : [emptyItem(t.category)]);
    })();

    return () => {
      cancel = true;
    };
  }, [open, templateId]);

  const updateItem = (id: string, patch: Partial<ComplianceChecklistItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

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
    const result = await saveSuperadminPlatformComplianceTemplate(
      {
        countryCode,
        name,
        description: description.trim() || null,
        category,
        frequency,
        items,
        showOnDisplay,
        isActive,
        sortOrder,
        version,
      },
      templateId,
    );
    setSaving(false);

    if (!result.ok) {
      toast.error("Speichern fehlgeschlagen.");
      return;
    }

    toast.success(isEdit ? "Vorlage aktualisiert." : "Vorlage angelegt.");
    onSaved();
    onOpenChange(false);
  };

  const bumpVersion = async () => {
    if (!templateId) return;
    const result = await bumpSuperadminPlatformComplianceTemplateVersion(templateId);
    if (!result.ok) {
      toast.error("Version konnte nicht erhöht werden.");
      return;
    }
    setVersion((v) => v + 1);
    toast.success("Versionsnummer erhöht.");
    onSaved();
  };

  const remove = async () => {
    if (!templateId) return;
    const result = await deleteSuperadminPlatformComplianceTemplate(templateId);
    if (!result.ok) {
      toast.error("Löschen fehlgeschlagen.");
      return;
    }
    toast.success("Vorlage gelöscht.");
    onSaved();
    onOpenChange(false);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent className={drawerContentClassName("overview")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              {isEdit ? "Checklisten-Vorlage bearbeiten" : "Neue Checklisten-Vorlage"}
            </DrawerTitle>
            <DrawerDescription className="text-base">
              Zentrale Vorlage für Eigenkontrolle — Restaurants importieren eine Kopie.
            </DrawerDescription>
          </DrawerHeader>

          <DrawerFormBody>
          <div className={drawerScrollAreaClassName(6)}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Laden …</p>
            ) : (
              <div className="space-y-6">
            <DrawerFormSection title="Allgemein" contentPadding={5}>
              <div className="grid gap-3 sm:grid-cols-2">
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
                    <SelectTrigger className={selectClass}>
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
                  <Label>Sortierung</Label>
                  <Input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Beschreibung</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kategorie</Label>
                  <SearchableSelect
                    value={category}
                    onValueChange={(v) => {
                      const next = v as ComplianceCategory;
                      setCategory(next);
                      if (!isEdit) setItems([emptyItem(next)]);
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
              <div className="mt-4 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={showOnDisplay} onCheckedChange={setShowOnDisplay} />
                  Standard: am Display anzeigen
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  Aktiv
                </label>
                {isEdit ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-muted-foreground">Version {version}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={loading || saving}
                      onClick={() => void bumpVersion()}
                    >
                      Version erhöhen
                    </Button>
                  </div>
                ) : null}
              </div>
            </DrawerFormSection>

            <DrawerFormSection title="Felder" contentPadding={5}>
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
                          onChange={(e) => updateItem(item.id, { label: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Feldtyp</Label>
                        <SearchableSelect
                          value={item.fieldType}
                          onValueChange={(v) =>
                            updateItem(item.id, { fieldType: v as ComplianceFieldType })
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
                      {item.fieldType === "select" ? (
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Optionen (kommagetrennt)</Label>
                          <Input
                            value={(item.options ?? []).join(", ")}
                            onChange={(e) =>
                              updateItem(item.id, {
                                options: e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="rounded-xl"
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
                  onClick={() => setItems((prev) => [...prev, emptyItem(category)])}
                >
                  <Plus className="size-4" />
                  Feld hinzufügen
                </Button>
              </div>
            </DrawerFormSection>
              </div>
            )}
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitLabel={isEdit ? "Speichern" : "Anlegen"}
            submitType="button"
            onSubmit={() => void save()}
            submitDisabled={saving || loading || !name.trim()}
            submitPending={saving}
            showDelete={isEdit}
            onDelete={() => setDeleteOpen(true)}
            deleteLabel="Vorlage löschen"
          />
          </DrawerFormBody>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Vorlage löschen?"
        description="Restaurants behalten bereits importierte Kopien."
        confirmLabel="Löschen"
        destructive
        onConfirm={() => void remove()}
      />
    </>
  );
}
