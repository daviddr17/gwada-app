import type { AccountingDocumentStatusRow } from "@/lib/types/accounting";
import { normalizeRestaurantPositionColor } from "@/lib/restaurant/restaurant-position-colors";

export function findAccountingStatus(
  code: string,
  statuses: AccountingDocumentStatusRow[],
): AccountingDocumentStatusRow | null {
  return statuses.find((s) => s.code === code) ?? null;
}

export function accountingStatusLabel(
  code: string,
  statuses: AccountingDocumentStatusRow[],
): string {
  return findAccountingStatus(code, statuses)?.label ?? code;
}

export function resolveAccountingStatusColor(
  status:
    | Pick<AccountingDocumentStatusRow, "color_hex" | "code">
    | null
    | undefined,
  fallbackCode?: string,
): string {
  return normalizeRestaurantPositionColor(
    status?.color_hex,
    status?.code ?? fallbackCode ?? "status",
  );
}

export function accountingStatusSelectOptions(
  statuses: AccountingDocumentStatusRow[],
): { value: string; label: string; leadingColor: string }[] {
  return statuses
    .filter((s) => !s.archived)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      value: s.code,
      label: s.label,
      leadingColor: resolveAccountingStatusColor(s),
    }));
}
