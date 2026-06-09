export const ACCOUNTING_PLATFORMS = ["gwada", "lexoffice"] as const;

export type AccountingPlatform = (typeof ACCOUNTING_PLATFORMS)[number];

export const ACCOUNTING_PLATFORM_LABELS: Record<AccountingPlatform, string> = {
  gwada: "Gwada",
  lexoffice: "Lexware",
};

export const ACCOUNTING_FILTER_ALL = "all" as const;

export type AccountingPlatformFilter =
  | typeof ACCOUNTING_FILTER_ALL
  | AccountingPlatform;

export const ACCOUNTING_FILTER_LABELS: Record<
  AccountingPlatformFilter,
  string
> = {
  all: "Alle",
  ...ACCOUNTING_PLATFORM_LABELS,
};

export function isAccountingPlatform(
  value: string,
): value is AccountingPlatform {
  return (ACCOUNTING_PLATFORMS as readonly string[]).includes(value);
}

export function parseAccountingPlatformFilter(
  platformParam: string | null,
): AccountingPlatformFilter {
  if (!platformParam || platformParam === ACCOUNTING_FILTER_ALL) {
    return ACCOUNTING_FILTER_ALL;
  }
  if (isAccountingPlatform(platformParam)) {
    return platformParam;
  }
  return ACCOUNTING_FILTER_ALL;
}
