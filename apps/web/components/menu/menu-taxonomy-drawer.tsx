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
import { MENU_TAXONOMY_COLOR_INPUT_CLASSNAME } from "@/lib/constants/menu-color-picker";
import type { MenuTaxonomyDefinition } from "@/lib/types/menu";

const HEX = /^#[0-9A-Fa-f]{6}$/;

type SavePayload =
  | { name: string; active?: boolean; backgroundColor: string }
  | { id: string; name: string; active: boolean; backgroundColor: string };

type MenuTaxonomyDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: MenuTaxonomyDefinition | null;
  variant: "tags" | "allergens" | "documentTags" | "staffPositionTags";
  onSave: (payload: SavePayload) => void;
  onDelete?: (id: string) => void | Promise<void>;
};

const COPY: Record<
  MenuTaxonomyDrawerProps["variant"],
  {
    titleCreate: string;
    titleEdit: string;
    description: string;
    deleteLabel: string;
  }
> = {
  tags: {
    titleCreate: "Neues Tag",
    titleEdit: "Tag bearbeiten",
    description: "Name, Sichtbarkeit und Chip-Farbe für Eigenschaften (z. B. Vegan, Spicy).",
    deleteLabel: "Tag löschen",
  },
  allergens: {
    titleCreate: "Neues Allergen",
    titleEdit: "Allergen bearbeiten",
    description: "Name, Sichtbarkeit und Chip-Farbe für Allergen-Kennzeichnung.",
    deleteLabel: "Allergen löschen",
  },
  documentTags: {
    titleCreate: "Neues Dokument-Tag",
    titleEdit: "Dokument-Tag bearbeiten",
    description:
      "Name, Sichtbarkeit und Chip-Farbe für die Zuordnung von Dokumenten.",
    deleteLabel: "Tag löschen",
  },
  staffPositionTags: {
    titleCreate: "Neue Position",
    titleEdit: "Position bearbeiten",
    description:
      "Name, Sichtbarkeit und Chip-Farbe für Mitarbeiter-Positionen.",
    deleteLabel: "Position löschen",
  },
};

export function MenuTaxonomyDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  variant,
  onSave,
  onDelete,
}: MenuTaxonomyDrawerProps) {
  const labels = COPY[variant];
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState("#64748b");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (mode === "edit" && initial) {
        setName(initial.name);
        setActive(initial.active !== false);
        setBackgroundColor(
          HEX.test(initial.backgroundColor)
            ? initial.backgroundColor
            : "#64748b",
        );
      } else {
        setName("");
        setActive(true);
        setBackgroundColor("#64748b");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, initial, open]);

  const canDelete = mode === "edit" && initial && onDelete;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const color = HEX.test(backgroundColor) ? backgroundColor : "#64748b";
    if (mode === "edit" && initial) {
      onSave({ id: initial.id, name: trimmed, active, backgroundColor: color });
    } else {
      onSave({ name: trimmed, active, backgroundColor: color });
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
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent
          className={drawerContentClassName("taxonomy")}
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
                  <Label htmlFor="taxonomy-name">Name</Label>
                  <Input
                    id="taxonomy-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={variant === "tags" ? "z. B. Bio" : "z. B. Sellerie"}
                    className="h-12 rounded-xl"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxonomy-color">Chip-Hintergrundfarbe</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="taxonomy-color"
                      type="color"
                      value={HEX.test(backgroundColor) ? backgroundColor : "#64748b"}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className={MENU_TAXONOMY_COLOR_INPUT_CLASSNAME}
                      aria-label="Farbe wählen"
                    />
                    <Input
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      placeholder="#64748b"
                      className="h-12 flex-1 rounded-xl font-mono text-sm"
                      spellCheck={false}
                      maxLength={7}
                      aria-label="Farbe als Hex"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hex-Wert (#rrggbb) – wird für Chips in Karte und Tabelle verwendet.
                  </p>
                </div>
              </DrawerFormSection>

              <DrawerFormSection title="Sichtbarkeit">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="taxonomy-active" className="text-sm font-medium">
                      Aktiv
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Inaktive Einträge erscheinen nicht in Auswahl und Filtern.
                    </p>
                  </div>
                  <Switch
                    id="taxonomy-active"
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
          title={`${labels.deleteLabel}?`}
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
