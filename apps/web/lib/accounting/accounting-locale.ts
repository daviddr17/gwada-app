import { DEFAULT_ACCOUNTING_TAX_RATES } from "@/lib/accounting/default-catalog";

/** Zentrale Defaults — später pro Restaurant überschreibbar. */
export const ACCOUNTING_DEFAULT_COUNTRY_CODE = "DE";
export const ACCOUNTING_DEFAULT_CURRENCY = "EUR";
export const ACCOUNTING_DEFAULT_LOCALE = "de-DE";

export type AccountingLocalePolicy = {
  countryCode: string;
  currency: string;
  locale: string;
  taxRatePresets: ReadonlyArray<{
    label: string;
    rate_percent: number;
    is_default: boolean;
    sort_order: number;
  }>;
};

export const DEFAULT_ACCOUNTING_LOCALE_POLICY: AccountingLocalePolicy = {
  countryCode: ACCOUNTING_DEFAULT_COUNTRY_CODE,
  currency: ACCOUNTING_DEFAULT_CURRENCY,
  locale: ACCOUNTING_DEFAULT_LOCALE,
  taxRatePresets: DEFAULT_ACCOUNTING_TAX_RATES,
};

export function formatAccountingMoney(
  amount: number,
  opts?: { currency?: string; locale?: string },
): string {
  const policy = DEFAULT_ACCOUNTING_LOCALE_POLICY;
  return new Intl.NumberFormat(opts?.locale ?? policy.locale, {
    style: "currency",
    currency: opts?.currency ?? policy.currency,
  }).format(amount);
}

export function formatAccountingDate(
  iso: string,
  opts?: { locale?: string },
): string {
  const policy = DEFAULT_ACCOUNTING_LOCALE_POLICY;
  return new Date(iso).toLocaleDateString(opts?.locale ?? policy.locale);
}
