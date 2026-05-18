"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { MENU_TAXONOMY_COLOR_INPUT_CLASSNAME } from "@/lib/constants/menu-color-picker";
import { cn } from "@/lib/utils";
import { useAccentColor } from "@/lib/contexts/accent-color-context";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";

const DEFAULT_ACCENT_NORMALIZED = normalizeHex(DEFAULT_ACCENT_HEX)!;

export function SettingsBrandingPanel() {
  const { accentHex, setAccentHex, isReady } = useAccentColor();
  const [draft, setDraft] = useState(DEFAULT_ACCENT_HEX);
  const [error, setError] = useState<string | null>(null);
  /** Hex vor „Standard“ – für Rückgängig (nur Entwurf, bis „Speichern“). */
  const [standardUndoHex, setStandardUndoHex] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!isReady) return;
    const frame = requestAnimationFrame(() => setDraft(accentHex));
    return () => cancelAnimationFrame(frame);
  }, [accentHex, isReady]);

  const colorPickerValue = normalizeHex(draft) ?? accentHex;

  useEffect(() => {
    const d = normalizeHex(draft);
    if (standardUndoHex === null) return;
    if (d && d !== DEFAULT_ACCENT_NORMALIZED) {
      setStandardUndoHex(null);
    }
  }, [draft, standardUndoHex]);

  const dirty = useMemo(() => {
    if (!isReady) return false;
    return normalizeHex(draft) !== normalizeHex(accentHex);
  }, [isReady, draft, accentHex]);

  const handleSave = useCallback(() => {
    const normalized = normalizeHex(draft);
    if (!normalized) {
      setError("Ungültiger Hex-Wert (z. B. #eab308)");
      return;
    }
    setError(null);
    setAccentHex(normalized);
    setStandardUndoHex(null);
  }, [draft, setAccentHex]);

  const handleStandard = () => {
    const cur = normalizeHex(draft) ?? normalizeHex(accentHex);
    if (!cur || cur === DEFAULT_ACCENT_NORMALIZED) {
      setDraft(DEFAULT_ACCENT_HEX);
      setError(null);
      return;
    }
    setStandardUndoHex(cur);
    setDraft(DEFAULT_ACCENT_HEX);
    setError(null);
  };

  const handleUndoStandard = () => {
    if (!standardUndoHex) return;
    setDraft(standardUndoHex);
    setStandardUndoHex(null);
  };

  const showStandardUndo =
    standardUndoHex !== null &&
    normalizeHex(draft) === DEFAULT_ACCENT_NORMALIZED &&
    standardUndoHex !== DEFAULT_ACCENT_NORMALIZED;

  return (
    <div className="space-y-0 pb-4">
      <form
        ref={formRef}
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <Card className="border-border/50 shadow-card">
          <CardHeader className="gap-2">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Restaurant-Branding
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Akzentfarbe für Buttons, Filter und Highlights. Gespeichert in
              Spalte <span className="font-mono text-foreground">brand_accent_hex</span>{" "}
              des aktuellen Restaurants (Supabase); falls leer, weiterhin älterer
              Workspace-Eintrag oder lokaler Fallback.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <Label htmlFor="accent-hex">Akzentfarbe (Hex)</Label>
            <div className="flex items-center gap-3">
              <input
                id="accent-color-picker"
                type="color"
                value={colorPickerValue}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  if (!dirty) return;
                  formRef.current?.requestSubmit();
                }}
                className={MENU_TAXONOMY_COLOR_INPUT_CLASSNAME}
                aria-label="Farbe wählen"
              />
              <Input
                id="accent-hex"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                  if (!dirty) return;
                  e.preventDefault();
                  formRef.current?.requestSubmit();
                }}
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

        <SettingsStickySaveBar show={dirty}>
          <Button
            type="submit"
            className={cn(
              "h-11 w-full min-w-[12rem] sm:w-auto",
              settingsAccentSaveButtonClassName,
            )}
          >
            Akzentfarbe speichern
          </Button>
        </SettingsStickySaveBar>
      </form>
    </div>
  );
}
