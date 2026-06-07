import { formatCentsAsDecimal } from "@gwada/shared";

/** Fiskaly SIGN DE v2 / DSFinV-K VAT rate identifiers (Germany). */
export const FISKALY_VAT_RATE_MAP: Readonly<Record<number, string>> = {
  19: "NORMAL",
  7: "REDUCED_1",
  0: "NULL",
};

export type VatLineInput = {
  /** Gross line total in integer cents (inclusive VAT). */
  totalCents: number;
  vatRate: number;
};

export type SignDeVatAmount = {
  vat_rate: string;
  amount: string;
  incl_vat: string;
  excl_vat: string;
  vat: string;
};

export type EkabsVatAmount = {
  percentage: string;
  incl_vat: string;
  excl_vat: string;
  vat: string;
};

function splitGrossCents(grossCents: number, vatRate: number): { netCents: number; vatCents: number } {
  if (vatRate === 19) {
    const netCents = Math.round(grossCents / 1.19);
    return { netCents, vatCents: grossCents - netCents };
  }
  if (vatRate === 7) {
    const netCents = Math.round(grossCents / 1.07);
    return { netCents, vatCents: grossCents - netCents };
  }
  return { netCents: grossCents, vatCents: 0 };
}

/** Group line items by VAT rate for Fiskaly SIGN DE (ported from Loyaro vat-calculator). */
export function buildSignDeVatAmounts(items: readonly VatLineInput[]): SignDeVatAmount[] {
  const byRate = new Map<number, number>();
  for (const item of items) {
    byRate.set(item.vatRate, (byRate.get(item.vatRate) ?? 0) + item.totalCents);
  }

  return Array.from(byRate.entries()).map(([vatRate, inclCents]) => {
    const { netCents, vatCents } = splitGrossCents(inclCents, vatRate);
    return {
      vat_rate: FISKALY_VAT_RATE_MAP[vatRate] ?? "NULL",
      amount: formatCentsAsDecimal(inclCents),
      incl_vat: formatCentsAsDecimal(inclCents),
      excl_vat: formatCentsAsDecimal(netCents),
      vat: formatCentsAsDecimal(vatCents),
    };
  });
}

/** eReceipt (ekabs_v0) shape for Fiskaly eReceipt API. */
export function buildEkabsVatAmounts(items: readonly VatLineInput[]): EkabsVatAmount[] {
  const byRate = new Map<number, number>();
  for (const item of items) {
    byRate.set(item.vatRate, (byRate.get(item.vatRate) ?? 0) + item.totalCents);
  }

  return Array.from(byRate.entries()).map(([vatRate, inclCents]) => {
    const { netCents, vatCents } = splitGrossCents(inclCents, vatRate);
    return {
      percentage: vatRate.toFixed(2),
      incl_vat: formatCentsAsDecimal(inclCents),
      excl_vat: formatCentsAsDecimal(netCents),
      vat: formatCentsAsDecimal(vatCents),
    };
  });
}

export function splitItemVatCents(
  grossCents: number,
  vatRate: number,
): { netCents: number; vatCents: number } {
  return splitGrossCents(grossCents, vatRate);
}
