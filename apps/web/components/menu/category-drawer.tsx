"use client";

import { useEffect, useRef, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/combobox";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  isIosTouchDevice,
  useDrawerFormKeyboardAssist,
} from "@/lib/hooks/use-drawer-form-keyboard-assist";
import type { MenuCategoryDefinition, MenuMainCategoryDefinition } from "@/lib/types/menu";

type CategorySavePayload =
  | { id?: undefined; name: string; active?: boolean; mainCategoryId?: string }
  | { id: string; name: string; active: boolean; mainCategoryId?: string };

export type CategoryDrawerLabels = {
  titleCreate: string;
  titleEdit: string;
  description: string;
  nameLabel: string;
  namePlaceholder: string;
  activeLabel: string;
  activeDescription: string;
  deleteLabel?: string;
  deleteConfirmTitle?: string;
};

const MENU_CATEGORY_LABELS: CategoryDrawerLabels = {
  titleCreate: "Neue Kategorie",
  titleEdit: "Kategorie bearbeiten",
  description: "Name und Sichtbarkeit – wie es in der Speisekarte erscheint.",
  nameLabel: "Name",
  namePlaceholder: "z. B. Mittagsangebot",
  activeLabel: "Aktiv",
  activeDescription:
    "Inaktive Kategorien werden abgeschwächt und sind optional ausblendbar.",
  deleteLabel: "Eintrag löschen",
  deleteConfirmTitle: "Eintrag wirklich löschen?",
};

type CategoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Nur bei mode edit */
  initial?: MenuCategoryDefinition | null;
  /** Speisekarte: Zuordnung zu Speisen / Getränke / … */
  mainCategories?: MenuMainCategoryDefinition[];
  defaultMainCategoryId?: string;
  onSave: (payload: CategorySavePayload) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  /** z. B. Bestand: Lieferanten, Zutatenkategorien, … */
  labels?: Partial<CategoryDrawerLabels>;
};

export function CategoryDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  mainCategories = [],
  defaultMainCategoryId,
  onSave,
  onDelete,
  labels: labelsProp,
}: CategoryDrawerProps) {
  const labels = { ...MENU_CATEGORY_LABELS, ...labelsProp };
  const scrollRef = useRef<HTMLDivElement>(null);
  const { repositionInputs } = useDrawerFormKeyboardAssist({ open, scrollRef });
  const [iosTouch, setIosTouch] = useState(false);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [mainCategoryId, setMainCategoryId] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIosTouch(isIosTouchDevice());
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const fallbackMainId =
        defaultMainCategoryId ??
        mainCategories.find((m) => m.active !== false)?.id ??
        mainCategories[0]?.id ??
        "";
      if (mode === "edit" && initial) {
        setName(initial.name);
        setActive(initial.active !== false);
        setMainCategoryId(initial.mainCategoryId || fallbackMainId);
      } else {
        setName("");
        setActive(true);
        setMainCategoryId(fallbackMainId);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, initial, open, mainCategories, defaultMainCategoryId]);

  const mainCategoryOptions = mainCategories.map((m) => ({
    value: m.id,
    label: m.name,
  }));
  const showMainCategoryField = mainCategories.length > 0;

  const canDelete = mode === "edit" && initial && onDelete;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Bitte einen Namen eingeben.");
      return;
    }
    if (showMainCategoryField && !mainCategoryId) {
      toast.error("Bitte eine Hauptkategorie wählen.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "edit" && initial) {
        await onSave({
          id: initial.id,
          name: trimmed,
          active,
          ...(showMainCategoryField ? { mainCategoryId } : {}),
        });
      } else {
        await onSave({
          name: trimmed,
          active,
          ...(showMainCategoryField ? { mainCategoryId } : {}),
        });
      }
      onOpenChange(false);
    } catch {
      /* Speichern bleibt offen; Fehlertoaster kommt vom Aufrufer. */
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!initial || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(initial.id);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        direction="bottom"
        repositionInputs={repositionInputs}
      >
        <DrawerContent className={drawerContentClassName("taxonomy")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <DrawerTitle className="text-xl font-semibold tracking-tight">
                  {mode === "edit" ? labels.titleEdit : labels.titleCreate}
                </DrawerTitle>
                <DrawerDescription className="text-base">
                  {labels.description}
                </DrawerDescription>
              </div>
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={labels.deleteLabel}
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </DrawerHeader>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div ref={scrollRef} className={drawerScrollAreaClassName(6)}>
              <DrawerFormSection title="Stammdaten">
                <div className="space-y-2">
                  <Label htmlFor="category-name">{labels.nameLabel}</Label>
                  <Input
                    id="category-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={labels.namePlaceholder}
                    className="h-12 rounded-xl"
                    /* Autofocus öffnet auf iOS die Tastatur und verdeckt Speichern. */
                    autoFocus={!iosTouch}
                    enterKeyHint="done"
                  />
                </div>
              </DrawerFormSection>

              {showMainCategoryField ? (
                <DrawerFormSection title="Zuordnung">
                  <div className="space-y-2">
                    <Label htmlFor="category-main-category">Hauptkategorie</Label>
                    <SearchableSelect
                      id="category-main-category"
                      value={mainCategoryId || null}
                      onValueChange={(v) => setMainCategoryId(v)}
                      options={mainCategoryOptions}
                      placeholder="Hauptkategorie wählen"
                      className={appSelectTriggerAccentCn("h-12 rounded-xl")}
                    />
                  </div>
                </DrawerFormSection>
              ) : null}

              <DrawerFormSection title="Sichtbarkeit">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="category-active"
                      className="text-sm font-medium"
                    >
                      {labels.activeLabel}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {labels.activeDescription}
                    </p>
                  </div>
                  <Switch
                    id="category-active"
                    checked={active}
                    onCheckedChange={(v) => setActive(v === true)}
                  />
                </div>
              </DrawerFormSection>
            </div>

            <DrawerFormFooter
              onCancel={() => onOpenChange(false)}
              submitType="submit"
              submitLabel={mode === "edit" ? "Speichern" : "Anlegen"}
              submitDisabled={saving}
            />
          </form>
        </DrawerContent>
      </Drawer>

      {canDelete ? (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title={labels.deleteConfirmTitle ?? "Eintrag wirklich löschen?"}
          description={
            initial ? (
              <>
                „<span className="font-medium text-foreground">{initial.name}</span>“
                wird dauerhaft entfernt.
              </>
            ) : null
          }
          confirmLabel="Löschen"
          destructive
          confirmDisabled={deleting}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}
    </>
  );
}
