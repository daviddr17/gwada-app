/** Gwada Staff — design tokens (aligned with web globals.css roles). */
export type ResolvedColorScheme = "light" | "dark";

export type ColorSchemePreference = "light" | "dark" | "system";

export type GwadaColors = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  occupied: string;
  occupiedMuted: string;
};

export const gwadaColorsLight: GwadaColors = {
  background: "#fafafa",
  surface: "#ffffff",
  border: "rgba(0,0,0,0.08)",
  text: "#0a0a0a",
  textMuted: "#737373",
  accent: "#2563eb",
  accentForeground: "#ffffff",
  destructive: "#dc2626",
  success: "#16a34a",
  successMuted: "rgba(22, 163, 74, 0.12)",
  warning: "#b45309",
  warningMuted: "rgba(180, 83, 9, 0.12)",
  occupied: "#2563eb",
  occupiedMuted: "rgba(37, 99, 235, 0.12)",
};

/** Hex approximation of web `.dark` tokens in globals.css */
export const gwadaColorsDark: GwadaColors = {
  background: "#1a1b1f",
  surface: "#222328",
  border: "rgba(255,255,255,0.09)",
  text: "#f5f5f4",
  textMuted: "#9ca3af",
  accent: "#2563eb",
  accentForeground: "#ffffff",
  destructive: "#f87171",
  success: "#4ade80",
  successMuted: "rgba(74, 222, 128, 0.14)",
  warning: "#fbbf24",
  warningMuted: "rgba(251, 191, 36, 0.14)",
  occupied: "#60a5fa",
  occupiedMuted: "rgba(96, 165, 250, 0.16)",
};

/** @deprecated Use `useStaffTheme().colors` */
export const gwadaColors = gwadaColorsLight;

export const gwadaRadii = {
  card: 12,
  button: 10,
  pill: 999,
} as const;

export const gwadaSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

const DEFAULT_ACCENT = gwadaColorsLight.accent;

function foregroundForBackground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0a0a0a" : "#ffffff";
}

export function parseAccentHex(hex: string | null | undefined): string | null {
  const raw = hex?.trim();
  if (!raw || !/^#[0-9A-Fa-f]{6}$/.test(raw)) return null;
  return raw;
}

export function resolveGwadaColors(
  scheme: ResolvedColorScheme,
  accentHex?: string | null,
): GwadaColors {
  const base = scheme === "dark" ? gwadaColorsDark : gwadaColorsLight;
  const accent = parseAccentHex(accentHex) ?? DEFAULT_ACCENT;
  return {
    ...base,
    accent,
    accentForeground: foregroundForBackground(accent),
  };
}

export function resolveColorScheme(
  preference: ColorSchemePreference,
  systemScheme: ResolvedColorScheme | null | undefined,
): ResolvedColorScheme {
  if (preference === "light" || preference === "dark") return preference;
  return systemScheme === "dark" ? "dark" : "light";
}
