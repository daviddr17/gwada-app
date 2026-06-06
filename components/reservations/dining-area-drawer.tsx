"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";
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
        className="mx-auto flex max-h-[min(92dvh,560px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated"
      >
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {mode === "edit" ? "Bereich bearbeiten" : "Neuer Bereich"}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Name, Nummer und Farbe.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col px-6 pb-4">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
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
          </div>

          <Separator className="mb-4" />

          <div className="flex gap-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-xl tap-scale"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className={cn("h-12 flex-1 ", brandActionButtonRoundedClassName)}
            >
              {mode === "edit" ? "Speichern" : "Anlegen"}
            </Button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
