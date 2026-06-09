export const CONTACT_CATALOG_PLATFORMS = ["gwada", "lexoffice"] as const;

export type ContactCatalogPlatform = (typeof CONTACT_CATALOG_PLATFORMS)[number];

export const CONTACT_CATALOG_PLATFORM_LABELS: Record<
  ContactCatalogPlatform,
  string
> = {
  gwada: "Gwada",
  lexoffice: "Lexware",
};

export const CONTACT_CATALOG_PLATFORM_ORDER: readonly ContactCatalogPlatform[] =
  CONTACT_CATALOG_PLATFORMS;

export function isContactCatalogPlatform(
  value: string,
): value is ContactCatalogPlatform {
  return (CONTACT_CATALOG_PLATFORMS as readonly string[]).includes(value);
}

export const CONTACT_CATALOG_FILTER_ALL = "all" as const;

export type ContactCatalogPlatformFilter =
  | typeof CONTACT_CATALOG_FILTER_ALL
  | ContactCatalogPlatform;

export const CONTACT_CATALOG_FILTER_LABELS: Record<
  ContactCatalogPlatformFilter,
  string
> = {
  all: "Alle",
  ...CONTACT_CATALOG_PLATFORM_LABELS,
};

export function isContactCatalogPlatformFilter(
  value: string,
): value is ContactCatalogPlatformFilter {
  return (
    value === CONTACT_CATALOG_FILTER_ALL || isContactCatalogPlatform(value)
  );
}

export function parseContactCatalogPlatformFilter(
  platformParam: string | null,
): ContactCatalogPlatformFilter {
  if (!platformParam || platformParam === CONTACT_CATALOG_FILTER_ALL) {
    return CONTACT_CATALOG_FILTER_ALL;
  }
  if (isContactCatalogPlatform(platformParam)) {
    return platformParam;
  }
  return CONTACT_CATALOG_FILTER_ALL;
}
