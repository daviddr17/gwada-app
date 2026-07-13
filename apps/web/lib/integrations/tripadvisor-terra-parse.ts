import "server-only";

export type TerraTranslation = {
  language?: string;
  value?: string;
  primary?: boolean;
};

export function terraLocalizedText(
  items: TerraTranslation[] | undefined,
  preferredLanguages: string[] = ["de", "en"],
): string | null {
  if (!items?.length) return null;

  for (const lang of preferredLanguages) {
    const match = items.find((entry) => entry.language === lang && entry.value?.trim());
    if (match?.value) return match.value.trim();
  }

  const primary = items.find((entry) => entry.primary && entry.value?.trim());
  if (primary?.value) return primary.value.trim();

  const any = items.find((entry) => entry.value?.trim());
  return any?.value?.trim() ?? null;
}
