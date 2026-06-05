import type { CSSProperties } from "react";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";

export type BrandProfileBackdropColors = {
  accent: string;
  harmony: string;
};

function rgbToHsl(r: number, g: number, b: number): [h: number, s: number, l: number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [r: number, g: number, b: number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (h < 60) [rn, gn, bn] = [c, x, 0];
  else if (h < 120) [rn, gn, bn] = [x, c, 0];
  else if (h < 180) [rn, gn, bn] = [0, c, x];
  else if (h < 240) [rn, gn, bn] = [0, x, c];
  else if (h < 300) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];

  return [
    Math.round((rn + m) * 255),
    Math.round((gn + m) * 255),
    Math.round((bn + m) * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Zweite Mesh-Farbe — warmes Analog wie Landing (Violett + Pink), bei warmen Akzenten kühler. */
export function deriveBrandHarmonyHex(accentHex: string): string {
  const normalized = normalizeHex(accentHex);
  if (!normalized) return "#ec4899";

  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const [h, s, l] = rgbToHsl(r, g, b);

  const isWarmAccent = h >= 12 && h <= 78;
  const hueShift = isWarmAccent ? 52 : 38;
  const nextH = (h + hueShift) % 360;
  const nextS = Math.min(0.88, Math.max(0.34, s * 0.98 + (s < 0.35 ? 0.08 : 0)));
  const nextL = Math.min(0.66, Math.max(0.4, l * 0.94 + 0.01));

  const [nr, ng, nb] = hslToRgb(nextH, nextS, nextL);
  return rgbToHex(nr, ng, nb);
}

export function brandProfileBackdropColors(
  accentHex: string,
): BrandProfileBackdropColors {
  const accent = normalizeHex(accentHex) ?? DEFAULT_ACCENT_HEX;
  return {
    accent,
    harmony: deriveBrandHarmonyHex(accent),
  };
}

export function profileHeroBlobBackground(
  color: string,
  strongOpacity: number,
): string {
  const softOpacity = Math.round(strongOpacity * 0.48);
  return [
    `radial-gradient(circle at 45% 42%, color-mix(in srgb, ${color} ${strongOpacity}%, transparent) 0%, color-mix(in srgb, ${color} ${softOpacity}%, transparent) 42%, transparent 68%)`,
  ].join(", ");
}

/** Statisches Mesh + Sheet-Backdrop — Landing-ähnlicher Zwei-Farben-Verlauf. */
export function brandedProfileBackdropStyle(accentHex: string): CSSProperties {
  const { accent, harmony } = brandProfileBackdropColors(accentHex);
  return {
    background: [
      `radial-gradient(ellipse 120% 80% at 50% 38%, color-mix(in srgb, ${accent} 64%, transparent) 0%, color-mix(in srgb, ${harmony} 18%, transparent) 34%, transparent 54%)`,
      `radial-gradient(ellipse 90% 65% at 82% 88%, color-mix(in srgb, ${harmony} 16%, transparent) 0%, transparent 55%)`,
      `radial-gradient(ellipse 95% 70% at 22% 88%, color-mix(in srgb, ${accent} 36%, transparent) 0%, transparent 52%)`,
      `radial-gradient(ellipse 70% 55% at 50% 62%, color-mix(in srgb, ${accent} 28%, transparent) 0%, transparent 58%)`,
      "linear-gradient(180deg, color-mix(in srgb, var(--background) 84%, transparent) 0%, var(--background) 100%)",
    ].join(", "),
  };
}
