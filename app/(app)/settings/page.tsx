"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  type SettingsNavSection,
  SettingsSectionNav,
  useSettingsSectionSpy,
} from "@/components/settings/settings-section-nav";
import { RestaurantSettingsPanel } from "@/components/settings/restaurant-settings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAccentColor } from "@/lib/contexts/accent-color-context";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";

/** Außerhalb der Komponente: stabile Referenz für den Scroll-Spy. */
const SETTINGS_SECTIONS: SettingsNavSection[] = [
  { id: "settings-restaurant", label: "Restaurant" },
  { id: "settings-hours", label: "Öffnungszeiten" },
  { id: "settings-branding", label: "Branding" },
];

export default function SettingsPage() {
  const { accentHex, setAccentHex, isReady } = useAccentColor();
  const [draft, setDraft] = useState(DEFAULT_ACCENT_HEX);
  const [error, setError] = useState<string | null>(null);
  const [belowLg, setBelowLg] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const sync = () => setBelowLg(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  const { activeId, scrollToSection } = useSettingsSectionSpy(
    SETTINGS_SECTIONS,
    {
      /** Sticky Mobilzeile (Dashboard + Tabs) unter dem App-Header */
      activationOffsetBelowHeader: belowLg ? 56 : 88,
    },
  );

  useEffect(() => {
    if (!isReady) return;
    const frame = requestAnimationFrame(() => setDraft(accentHex));
    return () => cancelAnimationFrame(frame);
  }, [accentHex, isReady]);

  const handleSave = () => {
    const normalized = normalizeHex(draft);
    if (!normalized) {
      setError("Ungültiger Hex-Wert (z. B. #eab308)");
      return;
    }
    setError(null);
    setAccentHex(normalized);
  };

  const preview = normalizeHex(draft) ?? accentHex;

  return (
    <div className="bg-background">
      <main className="mx-auto max-w-6xl px-4 pb-8 pt-0 sm:px-6 lg:py-8">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_11.5rem] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-12">
          <div className="min-w-0 space-y-8">
            <div
              className={cn(
                "lg:hidden",
                "sticky top-14 z-20 -mx-4 mb-2 border-b border-border/50 bg-background/95 px-4 py-2 shadow-sm backdrop-blur-xl supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6",
              )}
            >
              <div className="flex min-h-10 items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 px-2 text-muted-foreground"
                  aria-label="Zum Dashboard"
                  render={<Link href="/dashboard" prefetch />}
                >
                  <ArrowLeft className="size-4 shrink-0" />
                  <span className="truncate whitespace-nowrap">Dashboard</span>
                </Button>
                <SettingsSectionNav
                  sections={SETTINGS_SECTIONS}
                  activeId={activeId}
                  onNavigate={scrollToSection}
                  orientation="horizontal"
                  className="min-w-0 flex-1"
                />
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 hidden gap-2 text-muted-foreground lg:inline-flex"
              render={<Link href="/dashboard" prefetch />}
            >
              <ArrowLeft className="size-4" />
              Zum Dashboard
            </Button>

            <RestaurantSettingsPanel />

            <section
              id="settings-branding"
              className="scroll-mt-[7.25rem] lg:scroll-mt-[5.5rem]"
            >
              <Card className="border-border/50 shadow-card">
                <CardHeader className="gap-2">
                  <CardTitle className="text-2xl font-semibold tracking-tight">
                    Restaurant-Branding
                  </CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    Akzentfarbe für Buttons, Filter und Highlights. Später pro
                    Mandant in der Datenbank gespeichert.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div
                      className="size-16 shrink-0 rounded-2xl border border-border/60 shadow-card"
                      style={{ backgroundColor: preview }}
                      aria-hidden
                    />
                    <div>
                      <p className="text-sm font-medium">Vorschau</p>
                      <p className="font-mono text-sm text-muted-foreground">
                        {preview}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label htmlFor="accent-hex">Akzentfarbe (Hex)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="accent-color-picker"
                        type="color"
                        value={preview}
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
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-2 sm:flex-row">
                  <Button className="h-11 flex-1 tap-scale" onClick={handleSave}>
                    Akzentfarbe speichern
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 flex-1 tap-scale"
                    onClick={() => {
                      setDraft(DEFAULT_ACCENT_HEX);
                      setAccentHex(DEFAULT_ACCENT_HEX);
                      setError(null);
                    }}
                  >
                    Standard (Gold)
                  </Button>
                </CardFooter>
              </Card>
            </section>
          </div>

          <aside className="sticky top-24 z-10 hidden self-start lg:block">
            <SettingsSectionNav
              sections={SETTINGS_SECTIONS}
              activeId={activeId}
              onNavigate={scrollToSection}
              className="border-l border-border/40 pl-4"
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
