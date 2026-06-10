import type { AccountingVoucherItem } from "@/lib/types/accounting";

export function formatVoucherTaxRatesSummary(
  items: AccountingVoucherItem[] | null | undefined,
): string {
  if (!items?.length) return "—";
  const rates = [
    ...new Set(
      items
        .map((item) => item.taxRatePercent)
        .filter((rate) => Number.isFinite(rate) && rate > 0),
    ),
  ].sort((a, b) => b - a);

  if (!rates.length) return "—";
  return rates.map((rate) => `${rate} %`).join(", ");
}

export function voucherHasAttachment(row: {
  source: string;
  storage_path: string | null;
  file_name: string | null;
  external_id?: string | null;
}): boolean {
  if (row.storage_path) return true;
  if (row.source !== "lexoffice") return false;
  // Leerer String = Sync hat bestätigt: kein Lexware-Anhang
  if (row.file_name === "") return false;
  // UUID gespeichert oder noch nicht geprüft (null) → Anhang versuchen
  return Boolean(row.file_name?.trim()) || Boolean(row.external_id?.trim());
}

/** Für Vorschau: Lexware speichert die File-UUID in file_name, nicht den MIME-Typ. */
export function voucherPreviewMime(
  mimeType: string | null | undefined,
): string | null {
  if (!mimeType || mimeType === "lexoffice/file") return null;
  return mimeType;
}
