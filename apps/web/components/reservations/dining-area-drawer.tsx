"use client";

import { useEffect, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MENU_TAXONOMY_COLOR_INPUT_CLASSNAME } from "@/lib/constants/menu-color-picker";
import type { DiningAreaRow } from "@/lib/supabase/dining-floor-db";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export type DiningAreaSavePayload =
  | { name: string; displayNumber: number; colorHex: string }
  | { id: string; name: string; displayNumber: number; colorHex: string };

type DiningAreaDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: DiningAreaRow | null;
  /** Vorschlag für „Nummer“ bei Neuanlage (z. B. max+1). */
  suggestedDisplayNumber: number;
  onSave: (payload: DiningAreaSavePayload) => Promise<boolean>;
};

export function DiningAreaDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  suggestedDisplayNumber,
  onSave,
}: DiningAreaDrawerProps) {
  const [name, setName] = useState("");
  const [displayNumber, setDisplayNumber] = useState(String(suggestedDisplayNumber));
  const [colorHex, setColorHex] = useState("#64748b");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (mode === "edit" && initial) {
        setName(initial.name);
        setDisplayNumber(String(initial.display_number));
        setColorHex(HEX.test(initial.color_hex) ? initial.color_hex : "#64748b");
      } else {
        setName("");
        setDisplayNumber(String(suggestedDisplayNumber));
        setColorHex("#64748b");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, initial, open, suggestedDisplayNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const num = Number.parseInt(displayNumber, 10);
    if (!Number.isFinite(num) || num < 1 || num > 9999) return;
    const color = HEX.test(colorHex) ? colorHex : "#64748b";
    setSubmitting(true);
    try {
      const ok =
        mode === "edit" && initial
          ? await onSave({
              id: initial.id,
              name: trimmed,
              displayNumber: num,
              colorHex: color,
            })
          : await onSave({ name: trimmed, displayNumber: num, colorHex: color });
      if (ok) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        className={drawerContentClassName("template")}
      >
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {mode === "edit" ? "Bereich bearbeiten" : "Neuer Bereich"}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Name, Nummer und Farbe.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className={drawerScrollAreaClassName(6)}>
            <DrawerFormSection title="Stammdaten">
              <div className="space-y-2">
                <Label htmlFor="dining-area-number">Nummer</Label>
                <Input
                  id="dining-area-number"
                  inputMode="numeric"
                  value={displayNumber}
                  onChange={(e) => setDisplayNumber(e.target.value)}
                  placeholder="1"
                  className="h-12 rounded-xl font-mono tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  Eindeutig pro Restaurant (1–9999), z. B. für Sortierung und Anzeige am Chip.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dining-area-name">Name</Label>
                <Input
                  id="dining-area-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Terrasse"
                  className="h-12 rounded-xl"
                  autoFocus={mode === "create"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dining-area-color">Farbe</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="dining-area-color"
                    type="color"
                    value={HEX.test(colorHex) ? colorHex : "#64748b"}
                    onChange={(e) => setColorHex(e.target.value)}
                    className={MENU_TAXONOMY_COLOR_INPUT_CLASSNAME}
                    aria-label="Farbe wählen"
                  />
                  <Input
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    placeholder="#64748b"
                    className="h-12 flex-1 rounded-xl font-mono text-sm"
                    spellCheck={false}
                    maxLength={7}
                    aria-label="Farbe als Hex"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Hex-Wert (#rrggbb) – wie bei Tags/Allergenen in der Speisekarte.
                </p>
              </div>
            </DrawerFormSection>
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitType="submit"
            submitPending={submitting}
            submitLabel={mode === "edit" ? "Speichern" : "Anlegen"}
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
