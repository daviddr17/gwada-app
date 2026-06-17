"use client";

/** Ein Auto-Sync je Session für alle Buchführungs-Bereiche — vermeidet 3 parallele Lexware-Läufe. */
const CLIENT_AUTO_SYNC_COOLDOWN_MS = 30 * 60 * 1000;

function storageKey(restaurantId: string) {
  return `gwada:lexoffice-auto-sync:${restaurantId}`;
}

/** Pro Tab/Session: Lexware-Hintergrundsync höchstens alle 30 Minuten anstoßen. */
export function shouldRunAccountingLexofficeAutoSync(
  restaurantId: string,
  _scope: "invoices" | "quotations" | "vouchers",
): boolean {
  if (typeof sessionStorage === "undefined") return true;
  const raw = sessionStorage.getItem(storageKey(restaurantId));
  if (!raw) return true;
  const last = Number(raw);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last > CLIENT_AUTO_SYNC_COOLDOWN_MS;
}

export function markAccountingLexofficeAutoSync(
  restaurantId: string,
  _scope: "invoices" | "quotations" | "vouchers",
): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(storageKey(restaurantId), String(Date.now()));
}
