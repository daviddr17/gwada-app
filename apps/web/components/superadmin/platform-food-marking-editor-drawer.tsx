"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import {
  DrawerFormBody,
  DrawerFormSection,
} from "@/components/ui/drawer-form-section";
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
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { COUNTRIES_REFERENCE_FALLBACK } from "@/lib/constants/countries";
import type { FoodMarkingKind } from "@/lib/menu/food-marking-catalog";
import {
  deleteSuperadminPlatformFoodMarking,
  fetchSuperadminPlatformFoodMarking,
  saveSuperadminPlatformFoodMarking,
} from "@/lib/superadmin/platform-food-markings-api";
import {
  PLATFORM_FOOD_MARKING_KIND_LABELS,
  PLATFORM_FOOD_MARKING_KINDS,
} from "@/lib/types/platform-food-markings";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

export function PlatformFoodMarkingEditorDrawer({
  open,
  onOpenChange,
  markingId,
  defaultCountryCode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markingId: string | null;
  defaultCountryCode: string;
  onSaved: () => void;
}) {
  const isEdit = Boolean(markingId);
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<FoodMarkingKind>("additive");
  const [shortLabel, setShortLabel] = useState("");
  const [label, setLabel] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const countryOptions = useMemo(
    () =>
      COUNTRIES_REFERENCE_FALLBACK.filter((c) =>
        ["DE", "AT", "CH", "FR"].includes(c.iso2),
      ),
    [],
  );

  useEffect(() => {
    if (!open) return;
    setCountryCode(defaultCountryCode);
    if (!markingId) {
      setCode("");
      setKind("additive");
      setShortLabel("");
      setLabel("");
      setSortOrder(0);
      setIsActive(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchSuperadminPlatformFoodMarking(markingId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        toast.error("Eintrag konnte nicht geladen werden.");
        onOpenChange(false);
        return;
      }
      const m = result.marking;
      setCountryCode(m.countryCode);
      setCode(m.code);
      setKind(m.kind);
      setShortLabel(m.shortLabel);
      setLabel(m.label);
      setSortOrder(m.sortOrder);
      setIsActive(m.isActive);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, markingId, defaultCountryCode, onOpenChange]);

  const handleSave = async () => {
    const trimmedCode = code.trim();
    const trimmedLabel = label.trim();
    if (!trimmedCode || !trimmedLabel) {
      toast.error("Code und Bezeichnung sind Pflicht.");
      return;
    }
    setPending(true);
    const result = await saveSuperadminPlatformFoodMarking(
      {
        countryCode,
        code: trimmedCode,
        kind,
        shortLabel: shortLabel.trim() || trimmedCode,
        label: trimmedLabel,
        sortOrder,
        isActive,
      },
      markingId,
    );
    setPending(false);
    if (!result.ok) {
      toast.error(
        result.error?.includes("unique") || result.error?.includes("duplicate")
          ? "Dieser Code existiert bereits für das Land."
          : "Speichern fehlgeschlagen.",
      );
      return;
    }
    toast.success(isEdit ? "Eintrag gespeichert." : "Eintrag angelegt.");
    onSaved();
    onOpenChange(false);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={drawerContentClassName("form")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle>
              {isEdit ? "Kennzeichnung bearbeiten" : "Neue Kennzeichnung"}
            </DrawerTitle>
            <DrawerDescription>
              Code für Speisekarte/Zutaten (`marking_codes`). Bestehende Codes in
              Gerichten bleiben — bei Umbenennung lieber Label ändern.
            </DrawerDescription>
          </DrawerHeader>

          <div className={drawerScrollAreaClassName(6)}>
            <DrawerFormBody>
              {loading ? (
                <div className="space-y-3" aria-busy="true">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 rounded-xl border border-border/40 bg-muted/20"
                    />
                  ))}
                </div>
              ) : (
                <>
                  <DrawerFormSection title="Zuordnung">
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
                            className={appSelectTriggerAccentCn(
                              staffDrawerFieldClassName,
                            )}
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
                        <Label>Art</Label>
                        <Select
                          value={kind}
                          items={Object.fromEntries(
                            PLATFORM_FOOD_MARKING_KINDS.map((k) => [
                              k,
                              PLATFORM_FOOD_MARKING_KIND_LABELS[k],
                            ]),
                          )}
                          onValueChange={(v) => {
                            if (v === "additive" || v === "allergen") {
                              setKind(v);
                            }
                          }}
                        >
                          <SelectTrigger
                            className={appSelectTriggerAccentCn(
                              staffDrawerFieldClassName,
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PLATFORM_FOOD_MARKING_KINDS.map((k) => (
                              <SelectItem key={k} value={k}>
                                {PLATFORM_FOOD_MARKING_KIND_LABELS[k]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </DrawerFormSection>

                  <DrawerFormSection title="Anzeige">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="food-marking-code">Code</Label>
                        <Input
                          id="food-marking-code"
                          className={staffDrawerFieldClassName}
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder="a oder 1"
                          maxLength={32}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="food-marking-short">Kurzlabel</Label>
                        <Input
                          id="food-marking-short"
                          className={staffDrawerFieldClassName}
                          value={shortLabel}
                          onChange={(e) => setShortLabel(e.target.value)}
                          placeholder="meist = Code"
                          maxLength={32}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="food-marking-label">Bezeichnung</Label>
                      <Input
                        id="food-marking-label"
                        className={staffDrawerFieldClassName}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="mit Farbstoff"
                        maxLength={200}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="food-marking-sort">Reihenfolge</Label>
                        <Input
                          id="food-marking-sort"
                          type="number"
                          className={staffDrawerFieldClassName}
                          value={sortOrder}
                          onChange={(e) =>
                            setSortOrder(Number.parseInt(e.target.value, 10) || 0)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 px-3 py-2.5">
                        <Label htmlFor="food-marking-active" className="text-sm">
                          Aktiv (in Speisekarte wählbar)
                        </Label>
                        <Switch
                          id="food-marking-active"
                          checked={isActive}
                          onCheckedChange={setIsActive}
                        />
                      </div>
                    </div>
                  </DrawerFormSection>
                </>
              )}
            </DrawerFormBody>
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitLabel={isEdit ? "Speichern" : "Anlegen"}
            submitType="button"
            onSubmit={() => void handleSave()}
            submitDisabled={pending || loading || !code.trim() || !label.trim()}
            submitPending={pending}
            showDelete={isEdit}
            onDelete={() => setConfirmDelete(true)}
            deleteLabel="Löschen"
          />
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Kennzeichnung löschen?"
        description="Restaurants, die diesen Code schon gespeichert haben, behalten den Rohwert — er fehlt dann nur noch in der Auswahlliste."
        confirmLabel="Löschen"
        onConfirm={async () => {
          if (!markingId) return;
          setPending(true);
          const result = await deleteSuperadminPlatformFoodMarking(markingId);
          setPending(false);
          if (!result.ok) {
            toast.error("Löschen fehlgeschlagen.");
            throw new Error("delete failed");
          }
          toast.success("Eintrag gelöscht.");
          onSaved();
          onOpenChange(false);
        }}
      />
    </>
  );
}
