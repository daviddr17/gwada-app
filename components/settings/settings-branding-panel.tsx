"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar"
import { cn } from "@/lib/utils"
import { useAccentColor } from "@/lib/contexts/accent-color-context"
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants"
import { normalizeHex } from "@/lib/theme/color-utils"

export function SettingsBrandingPanel() {
  const { accentHex, setAccentHex, isReady } = useAccentColor()
  const [draft, setDraft] = useState(DEFAULT_ACCENT_HEX)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isReady) return
    const frame = requestAnimationFrame(() => setDraft(accentHex))
    return () => cancelAnimationFrame(frame)
  }, [accentHex, isReady])

  const colorPickerValue = normalizeHex(draft) ?? accentHex

  const dirty = useMemo(() => {
    if (!isReady) return false
    return normalizeHex(draft) !== normalizeHex(accentHex)
  }, [isReady, draft, accentHex])

  const handleSave = () => {
    const normalized = normalizeHex(draft)
    if (!normalized) {
      setError("Ungültiger Hex-Wert (z. B. #eab308)")
      return
    }
    setError(null)
    setAccentHex(normalized)
  }

  return (
    <div className="space-y-0 pb-4">
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
      >
      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Restaurant-Branding
          </CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Akzentfarbe für Buttons, Filter und Highlights. Später pro Mandant in
            der Datenbank gespeichert.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <Label htmlFor="accent-hex">Akzentfarbe (Hex)</Label>
          <div className="flex gap-2">
            <Input
              id="accent-color-picker"
              type="color"
              value={colorPickerValue}
              onChange={(e) => setDraft(e.target.value)}
              className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border-border/60 p-1"
              aria-label="Farbe wählen"
            />
            <Input
              id="accent-hex"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="#eab308"
              className="h-11 flex-1 font-mono"
              aria-invalid={!!error}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 tap-scale"
              onClick={() => {
                setDraft(DEFAULT_ACCENT_HEX)
                setAccentHex(DEFAULT_ACCENT_HEX)
                setError(null)
              }}
            >
              Standard (Gold)
            </Button>
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
  )
}
