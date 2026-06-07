/** Gesetz von der Chip-Leiste in `AppShell` (Pixel), für Sticky-Offsets in Modulen. */
export function readModuleChipStripHeightPx(): number {
  if (typeof document === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--app-module-chip-sticky-h")
    .trim();
  if (!raw) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}
