"use client";

import { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MENU_TAXONOMY_COLOR_INPUT_CLASSNAME } from "@/lib/constants/menu-color-picker";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";

const DEFAULT_ACCENT_NORMALIZED = normalizeHex(DEFAULT_ACCENT_HEX)!;

export type SettingsBrandingCardProps = {
  draft: string;
  onDraftChange: (hex: string) => void;
  savedHex: string;
  error?: string | null;
};

export function SettingsBrandingCard({
  draft,
  onDraftChange,
  savedHex,
  error = null,
}: SettingsBrandingCardProps) {
  /** Hex vor „Standard“ – für Rückgängig (nur Entwurf, bis Speichern). */
  const [standardUndoHex, setStandardUndoHex] = useState<string | null>(null);

  const colorPickerValue = normalizeHex(draft) ?? savedHex;

  useEffect(() => {
    const d = normalizeHex(draft);
    if (standardUndoHex === null) return;
    if (d && d !== DEFAULT_ACCENT_NORMALIZED) {
      setStandardUndoHex(null);
    }
  }, [draft, standardUndoHex]);

  const handleStandard = () => {
    const cur = normalizeHex(draft) ?? normalizeHex(savedHex);
    if (!cur || cur === DEFAULT_ACCENT_NORMALIZED) {
      onDraftChange(DEFAULT_ACCENT_HEX);
      return;
    }
    setStandardUndoHex(cur);
    onDraftChange(DEFAULT_ACCENT_HEX);
  };

  const handleUndoStandard = () => {
    if (!standardUndoHex) return;
    onDraftChange(standardUndoHex);
    setStandardUndoHex(null);
  };

  const showStandardUndo =
    standardUndoHex !== null &&
    normalizeHex(draft) === DEFAULT_ACCENT_NORMALIZED &&
    standardUndoHex !== DEFAULT_ACCENT_NORMALIZED;

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="gap-2">
        <CardTitle className="text-xl">Branding</CardTitle>
        <CardDescription>
          Akzentfarbe für Buttons, Filter und Highlights in der App.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <Label htmlFor="accent-hex">Akzentfarbe (Hex)</Label>
        <div className="flex items-center gap-3">
          <input
            id="accent-color-picker"
            type="color"
            value={colorPickerValue}
            onChange={(e) => onDraftChange(e.target.value)}
            className={MENU_TAXONOMY_COLOR_INPUT_CLASSNAME}
            aria-label="Farbe wählen"
          />
          <Input
            id="accent-hex"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="#eab308"
            className="h-12 flex-1 rounded-xl font-mono text-sm"
            aria-invalid={!!error}
            spellCheck={false}
            maxLength={7}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="h-10 tap-scale"
            onClick={handleStandard}
          >
            Standard
          </Button>
          {showStandardUndo ? (
            <Button
              type="button"
              variant="ghost"
              className="h-10 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleUndoStandard}
            >
              <Undo2 className="size-4 shrink-0" aria-hidden />
              Vorherige Farbe
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
