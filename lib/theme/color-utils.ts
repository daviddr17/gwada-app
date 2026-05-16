import { DEFAULT_ACCENT_HEX } from "./constants";

export function normalizeHex(hex: string): string | null {
  const raw = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const expanded = raw
      .split("")
      .map((c) => c + c)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }
  return null;
}

export function getAccentForeground(hex: string): string {
  const n = normalizeHex(hex);
  if (!n) return "#171717";
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#171717" : "#fafafa";
}

export function applyAccentToDocument(hex: string) {
  const normalized = normalizeHex(hex) ?? DEFAULT_ACCENT_HEX;
  const root = document.documentElement;
  root.style.setProperty("--brand-accent", normalized);
  root.style.setProperty("--accent", normalized);
  root.style.setProperty("--ring", normalized);
  root.style.setProperty(
    "--accent-foreground",
    getAccentForeground(normalized),
  );
}
