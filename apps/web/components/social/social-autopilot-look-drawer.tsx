"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MENU_TAXONOMY_COLOR_INPUT_CLASSNAME } from "@/lib/constants/menu-color-picker";
import {
  SOCIAL_DISPLAY_FONTS,
  SOCIAL_DISPLAY_FONT_CSS,
  SOCIAL_DISPLAY_FONT_HINTS,
  SOCIAL_DISPLAY_FONT_LABELS,
  SOCIAL_FEED_LAYOUT_HINTS,
  SOCIAL_FEED_LAYOUT_IDS,
  SOCIAL_FEED_LAYOUT_LABELS,
  SOCIAL_PHOTO_LOOK_HINTS,
  SOCIAL_PHOTO_LOOK_LABELS,
  SOCIAL_PHOTO_LOOKS,
  SOCIAL_STYLE_PRESETS,
  SOCIAL_STYLE_PRESET_HINTS,
  SOCIAL_STYLE_PRESET_LABELS,
  brandMotifPreviewSvg,
  togglePreferredFeedLayout,
  type SocialBrandKit,
  type SocialDisplayFontId,
  type SocialFeedLayoutId,
  type SocialFeedPalette,
  type SocialPhotoLook,
  type SocialStylePreset,
} from "@/lib/social/social-brand-kit";
import { normalizeHex } from "@/lib/theme/color-utils";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

function FeedColorRow({
  id,
  label,
  hint,
  value,
  allowEmpty,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  allowEmpty?: boolean;
  onChange: (hex: string) => void;
}) {
  const pickerValue = normalizeHex(value) ?? "#c4a574";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className={MENU_TAXONOMY_COLOR_INPUT_CLASSNAME}
          aria-label={`${label} wählen`}
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={allowEmpty ? "optional" : "#c4a574"}
          className="h-11 flex-1 rounded-xl font-mono text-sm"
          spellCheck={false}
          maxLength={7}
        />
        {allowEmpty && value.trim() ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11 shrink-0 rounded-xl px-3 text-xs text-muted-foreground"
            onClick={() => onChange("")}
          >
            Weg
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function patchPalette(
  kit: SocialBrandKit,
  patch: Partial<SocialFeedPalette>,
): SocialBrandKit {
  return {
    ...kit,
    feedPalette: { ...kit.feedPalette, ...patch },
  };
}

/**
 * Sekundäre Look-Optionen (Palette, Foto-Look, Layouts) — Bottom Sheet.
 */
export function SocialAutopilotLookDrawer({
  open,
  onOpenChange,
  kit,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit: SocialBrandKit;
  onChange: (next: SocialBrandKit) => void;
}) {
  const palette = kit.feedPalette;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("form")}>
        <DrawerHeader className="text-left">
          <DrawerTitle>Aussehen</DrawerTitle>
          <DrawerDescription>
            Stil, Schrift und Farben werden Teil des Bildes — nicht nur Overlay.
          </DrawerDescription>
        </DrawerHeader>

        <div className={cn(drawerScrollAreaClassName(6), "space-y-6 pb-4")}>
          <section className="space-y-2">
            <Label>Stil</Label>
            <p className="text-xs text-muted-foreground">
              Linien, Formen und Pinselstriche aus eurer Marke.
            </p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Stil"
            >
              {SOCIAL_STYLE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    kit.stylePreset === preset
                      ? "border-accent/50 bg-accent/15 text-foreground"
                      : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                  aria-pressed={kit.stylePreset === preset}
                  onClick={() =>
                    onChange({
                      ...kit,
                      stylePreset: preset as SocialStylePreset,
                    })
                  }
                >
                  {SOCIAL_STYLE_PRESET_LABELS[preset]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {SOCIAL_STYLE_PRESET_HINTS[kit.stylePreset]}
            </p>
            <div
              className="pt-1"
              dangerouslySetInnerHTML={{
                __html: brandMotifPreviewSvg({
                  stylePreset: kit.stylePreset,
                  accent: palette.accent,
                  secondary: palette.secondary ?? palette.accent,
                }),
              }}
              aria-hidden
            />
          </section>

          <section className="space-y-2">
            <Label>Schrift</Label>
            <p className="text-xs text-muted-foreground">
              Typeface für Überschriften und Markennamen im Post.
            </p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Schrift"
            >
              {SOCIAL_DISPLAY_FONTS.map((font) => (
                <button
                  key={font}
                  type="button"
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    kit.displayFont === font
                      ? "border-accent/50 bg-accent/15 text-foreground"
                      : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                  style={{ fontFamily: SOCIAL_DISPLAY_FONT_CSS[font] }}
                  aria-pressed={kit.displayFont === font}
                  onClick={() =>
                    onChange({
                      ...kit,
                      displayFont: font as SocialDisplayFontId,
                    })
                  }
                >
                  {SOCIAL_DISPLAY_FONT_LABELS[font]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {SOCIAL_DISPLAY_FONT_HINTS[kit.displayFont]}
            </p>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-sm font-medium">Farben</p>
              <p className="text-xs text-muted-foreground">
                Als Pinsel, Linien und Flächen im Creative.
              </p>
            </div>
            <div
              className="flex h-10 overflow-hidden rounded-xl border border-border/40"
              aria-hidden
            >
              <span
                className="flex-1"
                style={{ backgroundColor: palette.surfaceDark }}
              />
              <span
                className="flex-1"
                style={{ backgroundColor: palette.accent }}
              />
              <span
                className="flex-1"
                style={{
                  backgroundColor: palette.secondary ?? palette.surfaceLight,
                }}
              />
              <span
                className="flex-1"
                style={{ backgroundColor: palette.surfaceLight }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FeedColorRow
                id="look-accent"
                label="Akzent"
                hint="Highlights"
                value={palette.accent}
                onChange={(hex) => onChange(patchPalette(kit, { accent: hex }))}
              />
              <FeedColorRow
                id="look-secondary"
                label="Zweitfarbe"
                hint="Optional"
                value={palette.secondary ?? ""}
                allowEmpty
                onChange={(hex) =>
                  onChange(
                    patchPalette(kit, {
                      secondary: hex.trim() ? hex : null,
                    }),
                  )
                }
              />
              <FeedColorRow
                id="look-dark"
                label="Dunkle Fläche"
                hint="Panels"
                value={palette.surfaceDark}
                onChange={(hex) =>
                  onChange(patchPalette(kit, { surfaceDark: hex }))
                }
              />
              <FeedColorRow
                id="look-light"
                label="Helle Fläche"
                hint="Ruhige Posts"
                value={palette.surfaceLight}
                onChange={(hex) =>
                  onChange(patchPalette(kit, { surfaceLight: hex }))
                }
              />
            </div>
          </section>

          <section className="space-y-2">
            <Label>Foto-Look</Label>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Foto-Look"
            >
              {SOCIAL_PHOTO_LOOKS.map((look) => (
                <button
                  key={look}
                  type="button"
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    kit.photoLook === look
                      ? "border-accent/50 bg-accent/15 text-foreground"
                      : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                  aria-pressed={kit.photoLook === look}
                  onClick={() =>
                    onChange({
                      ...kit,
                      photoLook: look as SocialPhotoLook,
                    })
                  }
                >
                  {SOCIAL_PHOTO_LOOK_LABELS[look]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {SOCIAL_PHOTO_LOOK_HINTS[kit.photoLook]}
            </p>
          </section>

          <section className="space-y-2">
            <Label>Layouts</Label>
            <p className="text-xs text-muted-foreground">
              Mindestens eines — Autopilot rotiert in eurer Auswahl.
            </p>
            <div className="grid gap-2">
              {SOCIAL_FEED_LAYOUT_IDS.map((layoutId) => {
                const checked = kit.preferredLayouts.includes(layoutId);
                return (
                  <label
                    key={layoutId}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                      checked
                        ? "border-accent/40 bg-accent/5"
                        : "border-border/50 hover:border-border",
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={checked}
                      onCheckedChange={(v) => {
                        const on = v === true;
                        onChange({
                          ...kit,
                          preferredLayouts: togglePreferredFeedLayout(
                            kit.preferredLayouts,
                            layoutId as SocialFeedLayoutId,
                            on,
                          ),
                        });
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {SOCIAL_FEED_LAYOUT_LABELS[layoutId]}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {SOCIAL_FEED_LAYOUT_HINTS[layoutId]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <DrawerFooter>
          <Button
            type="button"
            className={cn("h-11 w-full", brandActionButtonRoundedClassName)}
            onClick={() => onOpenChange(false)}
          >
            Fertig
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
