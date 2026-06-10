import { ACCOUNTING_PLATFORM_LABELS } from "@/lib/constants/accounting-platforms";
import type { AccountingSource } from "@/lib/types/accounting";

/** Dokument stammt aus externer Buchhaltung (nicht rein lokal in Gwada). */
export function isExternalAccountingSource(source: AccountingSource): boolean {
  return source !== "gwada";
}

/** Externe Dokumente nur im Quellsystem bearbeiten. */
export function isReadOnlyAccountingDocument(source: AccountingSource): boolean {
  return isExternalAccountingSource(source);
}

export function accountingSourceDisplayLabel(source: AccountingSource): string {
  return ACCOUNTING_PLATFORM_LABELS[source] ?? source;
}

export function accountingReadOnlyEditError(
  documentLabel: string,
  source: AccountingSource,
): string {
  const platform = accountingSourceDisplayLabel(source);
  return `${documentLabel} können nur in ${platform} bearbeitet werden.`;
}
