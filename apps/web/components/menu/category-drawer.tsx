"use client";

import { useEffect, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { Trash2 } from "lucide-react";
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
import type { MenuCategoryDefinition } from "@/lib/types/menu";

type CategorySavePayload =
  | { id?: undefined; name: string; active?: boolean }
  | { id: string; name: string; active: boolean };

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
  onSave: (payload: CategorySavePayload) => void;
  onDelete?: (id: string) => void | Promise<void>;
  /** z. B. Bestand: Lieferanten, Zutatenkategorien, … */
  labels?: Partial<CategoryDrawerLabels>;
};

export function CategoryDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  onSave,
  onDelete,
  labels: labelsProp,
}: CategoryDrawerProps) {
  const labels = { ...MENU_CATEGORY_LABELS, ...labelsProp };
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (mode === "edit" && initial) {
        setName(initial.name);
        setActive(initial.active !== false);
      } else {
        setName("");
        setActive(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, initial, open]);

  const canDelete = mode === "edit" && initial && onDelete;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (mode === "edit" && initial) {
      onSave({ id: initial.id, name: trimmed, active });
    } else {
      onSave({ name: trimmed, active });
    }
    onOpenChange(false);
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
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent
          className={drawerContentClassName("assign")}
        >
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

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className={drawerScrollAreaClassName(6)}>
              <DrawerFormSection title="Stammdaten">
                <div className="space-y-2">
                  <Label htmlFor="category-name">{labels.nameLabel}</Label>
                  <Input
                    id="category-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={labels.namePlaceholder}
                    className="h-12 rounded-xl"
                    autoFocus
                  />
                </div>
              </DrawerFormSection>

              <DrawerFormSection title="Sichtbarkeit">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="category-active" className="text-sm font-medium">
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
