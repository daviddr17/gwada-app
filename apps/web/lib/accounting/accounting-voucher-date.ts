import type { AccountingVoucherDateKind } from "@/lib/types/accounting";

export function voucherDateKindOptions(documentKind: "invoice" | "quotation") {
  if (documentKind === "invoice") {
    return [
      { value: "date", label: "Rechnungsdatum" },
      { value: "period", label: "Rechnungszeitraum" },
    ] satisfies Array<{ value: AccountingVoucherDateKind; label: string }>;
  }
  return [
    { value: "date", label: "Angebotsdatum" },
    { value: "period", label: "Angebotszeitraum" },
  ] satisfies Array<{ value: AccountingVoucherDateKind; label: string }>;
}

export function resolveStoredVoucherDate(params: {
  voucherDateKind: AccountingVoucherDateKind;
  voucherDate: string;
  voucherPeriodEnd: string | null;
}): string {
  if (params.voucherDateKind === "period" && params.voucherPeriodEnd) {
    return params.voucherPeriodEnd;
  }
  return params.voucherDate;
}

export function formatGermanYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}.${m}.${y}`;
}

export function buildVoucherPeriodIntroduction(params: {
  voucherDateKind: AccountingVoucherDateKind;
  voucherPeriodStart: string | null;
  voucherPeriodEnd: string | null;
  introduction?: string | null;
}): string | null {
  if (params.voucherDateKind !== "period") {
    return params.introduction?.trim() || null;
  }
  if (!params.voucherPeriodStart || !params.voucherPeriodEnd) {
    return params.introduction?.trim() || null;
  }
  const periodLine = `Leistungszeitraum: ${formatGermanYmd(params.voucherPeriodStart)} – ${formatGermanYmd(params.voucherPeriodEnd)}`;
  const intro = params.introduction?.trim();
  return intro ? `${intro}\n${periodLine}` : periodLine;
}
