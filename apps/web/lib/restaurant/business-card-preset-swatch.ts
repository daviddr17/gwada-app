import type { BusinessCardPreset } from "@/lib/restaurant/business-card-presets";
import { normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";

/** Kompakte Farb-/Layout-Vorschau für Stil-Vorlagen (Sidebar). */
export function businessCardPresetSwatchStyle(
  preset: BusinessCardPreset,
  accentHex: string,
): {
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  mutedColor: string;
} {
  const colors = preset.colors(accentHex);
  return {
    backgroundColor: colors.background,
    accentColor: normalizeHex(colors.accent) ?? normalizeHex(accentHex) ?? DEFAULT_ACCENT_HEX,
    textColor: colors.text,
    mutedColor: colors.muted,
  };
}
