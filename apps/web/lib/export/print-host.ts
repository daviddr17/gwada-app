export type PrintJsPdfResult = "printed" | "shared" | "opened_tab";

/** iPhone, iPod, iPad (inkl. iPadOS mit Desktop-UA). */
export function isIosTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Electron / IDE-eingebettete Browser (z. B. Cursor Simple Browser):
 * `iframe.contentWindow.print()` auf PDFs kann die Host-App abstürzen lassen.
 */
export function isEmbeddedPrintHost(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Electron|Cursor|VSCode|Code\//i.test(ua);
}

export function shouldAutoTriggerPrintDialog(): boolean {
  return !isEmbeddedPrintHost();
}
