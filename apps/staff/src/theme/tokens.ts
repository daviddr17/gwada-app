/** Gwada Staff — design tokens (aligned with web accent roles). */
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
};

export const gwadaColors: GwadaColors = {
  background: "#fafafa",
  surface: "#ffffff",
  border: "rgba(0,0,0,0.08)",
  text: "#0a0a0a",
  textMuted: "#737373",
  accent: "#2563eb",
  accentForeground: "#ffffff",
  destructive: "#dc2626",
  success: "#16a34a",
} as const;

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
