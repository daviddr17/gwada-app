"use client";

const CLIENT_AUTO_SYNC_COOLDOWN_MS = 15 * 60 * 1000;

function storageKey(restaurantId: string, scope: string) {
  return `gwada:lexoffice-auto-sync:${restaurantId}:${scope}`;
}

/** Pro Tab/Session: Auto-Sync je Bereich höchstens alle 15 Minuten anstoßen. */
export function shouldRunAccountingLexofficeAutoSync(
  restaurantId: string,
  scope: "invoices" | "quotations" | "vouchers",
): boolean {
  if (typeof sessionStorage === "undefined") return true;
  const raw = sessionStorage.getItem(storageKey(restaurantId, scope));
  if (!raw) return true;
  const last = Number(raw);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last > CLIENT_AUTO_SYNC_COOLDOWN_MS;
}

export function markAccountingLexofficeAutoSync(
  restaurantId: string,
  scope: "invoices" | "quotations" | "vouchers",
): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(storageKey(restaurantId, scope), String(Date.now()));
}
