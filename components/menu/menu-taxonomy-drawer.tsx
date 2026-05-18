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
  variant: "tags" | "allergens";
  onSave: (payload: SavePayload) => void;
};

const COPY: Record<
  MenuTaxonomyDrawerProps["variant"],
  { titleCreate: string; titleEdit: string; description: string }
> = {
  tags: {
    titleCreate: "Neues Tag",
    titleEdit: "Tag bearbeiten",
    description: "Name, Sichtbarkeit und Chip-Farbe für Eigenschaften (z. B. Vegan, Spicy).",
  },
  allergens: {
    titleCreate: "Neues Allergen",
    titleEdit: "Allergen bearbeiten",
    description: "Name, Sichtbarkeit und Chip-Farbe für Allergen-Kennzeichnung.",
  },
};

export function MenuTaxonomyDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  variant,
  onSave,
}: MenuTaxonomyDrawerProps) {
  const labels = COPY[variant];
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState("#64748b");

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

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        showHandle
        className="mx-auto flex max-h-[min(92dvh,520px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated"
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

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/25 px-4 py-3">
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
