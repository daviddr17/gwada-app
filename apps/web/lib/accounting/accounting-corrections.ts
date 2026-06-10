import type {
  AccountingLineItem,
  AccountingVoucherItem,
} from "@/lib/types/accounting";

function newItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isAccountingCorrectionVariant(
  variant: string | null | undefined,
): boolean {
  return variant === "correction";
}

export function canCreateAccountingCorrection(
  variant: string | null | undefined,
): boolean {
  return !isAccountingCorrectionVariant(variant);
}

export function negateLineItems(items: AccountingLineItem[]): AccountingLineItem[] {
  return items.map((item) => {
    if (item.type === "text") {
      return { ...item, id: newItemId() };
    }
    const unitPrice =
      item.unitPrice === 0 ? 0 : -Math.abs(item.unitPrice);
    const lineAmount =
      item.lineAmount === 0 ? 0 : -Math.abs(item.lineAmount);
    return {
      ...item,
      id: newItemId(),
      unitPrice,
      lineAmount,
    };
  });
}

export function negateVoucherItems(
  items: AccountingVoucherItem[],
): AccountingVoucherItem[] {
  return items.map((item) => ({
    ...item,
    id: newItemId(),
    amount: item.amount === 0 ? 0 : -Math.abs(item.amount),
    taxAmount: item.taxAmount === 0 ? 0 : -Math.abs(item.taxAmount),
  }));
}

export function correctionIntroductionText(
  originalNumber: string | null | undefined,
): string {
  if (originalNumber?.trim()) {
    return `Korrektur zu ${originalNumber.trim()}`;
  }
  return "Korrektur";
}

export function correctionRemarkDefault(
  originalNumber: string | null | undefined,
): string {
  if (originalNumber?.trim()) {
    return `Korrekturbuchung zu ${originalNumber.trim()}.`;
  }
  return "Korrekturbuchung.";
}
