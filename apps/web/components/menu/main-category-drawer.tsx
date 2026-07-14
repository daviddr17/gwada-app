"use client";

import { useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerScrollAreaClassName,
  drawerFormHeaderClassName,
} from "@/lib/ui/drawer-form-section";
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
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import type { MenuMainCategoryDefinition } from "@/lib/types/menu";

type MainCategorySavePayload =
  | { id?: undefined; name: string; active?: boolean }
  | { id: string; name: string; active: boolean };

type MainCategoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: MenuMainCategoryDefinition | null;
  onSave: (payload: MainCategorySavePayload) => void;
  onDelete?: (id: string) => void | Promise<void>;
};

export function MainCategoryDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  onSave,
  onDelete,
}: MainCategoryDrawerProps) {
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useDrawerFormSeed(open, `${mode}:${initial?.id ?? "__create__"}`, () => {
    if (mode === "edit" && initial) {
      setName(initial.name);
      setActive(initial.active !== false);
      return;
    }
    setName("");
    setActive(true);
  });

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
        <DrawerContent className={drawerContentClassName("assign")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <DrawerTitle className="text-xl font-semibold tracking-tight">
                  {mode === "edit"
                    ? "Hauptkategorie bearbeiten"
                    : "Neue Hauptkategorie"}
                </DrawerTitle>
                <DrawerDescription className="text-base">
                  Obere Ebene der Speisekarte — z. B. Speisen oder Getränke.
                </DrawerDescription>
              </div>
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Eintrag löschen"
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
                  <Label htmlFor="main-category-name">Name</Label>
                  <Input
                    id="main-category-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z. B. Speisen"
                    className="h-12 rounded-xl"
                    autoFocus
                  />
                </div>
              </DrawerFormSection>

              <DrawerFormSection title="Sichtbarkeit">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="main-category-active" className="text-sm font-medium">
                      Aktiv
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Inaktive Hauptkategorien werden in der Leiste abgeschwächt.
                    </p>
                  </div>
                  <Switch
                    id="main-category-active"
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
          title="Eintrag wirklich löschen?"
          description={
            initial ? (
              <>
                „<span className="font-medium text-foreground">{initial.name}</span>“
                wird dauerhaft entfernt. Kategorien in dieser Hauptkategorie müssen
                zuerst verschoben oder gelöscht werden.
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
