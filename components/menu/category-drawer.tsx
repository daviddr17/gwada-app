"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
};

type CategoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Nur bei mode edit */
  initial?: MenuCategoryDefinition | null;
  onSave: (payload: CategorySavePayload) => void;
  /** z. B. Bestand: Lieferanten, Zutatenkategorien, … */
  labels?: Partial<CategoryDrawerLabels>;
};

export function CategoryDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  onSave,
  labels: labelsProp,
}: CategoryDrawerProps) {
  const labels = { ...MENU_CATEGORY_LABELS, ...labelsProp };
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);

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

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent
        showHandle
        className="mx-auto flex max-h-[min(92dvh,480px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated"
      >
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {mode === "edit" ? labels.titleEdit : labels.titleCreate}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {labels.description}
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col px-6 pb-4">
          <div className="space-y-4 pb-4">
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
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/25 px-4 py-3">
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
          </div>

          <Separator className="mb-4" />

          <div className="flex gap-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-xl tap-scale"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              className="h-12 flex-1 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 tap-scale"
            >
              {mode === "edit" ? "Speichern" : "Anlegen"}
            </Button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
