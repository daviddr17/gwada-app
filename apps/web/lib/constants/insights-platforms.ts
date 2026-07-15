/** Insights: Plattform-Chips (Gwada Standard, dann verbundene Kanäle). */

export const INSIGHTS_PLATFORMS = [
  "gwada",
  "google_business",
  "facebook",
  "instagram",
  "tripadvisor",
  "lexoffice",
] as const;

export type InsightsPlatform = (typeof INSIGHTS_PLATFORMS)[number];

export const INSIGHTS_PLATFORM_LABELS: Record<InsightsPlatform, string> = {
  gwada: "Gwada",
  google_business: "Google",
  facebook: "Facebook",
  instagram: "Instagram",
  tripadvisor: "TripAdvisor",
  lexoffice: "Lexoffice",
};

/** Reihenfolge der Chips — Gwada zuerst, dann externe Kanäle. */
export const INSIGHTS_PLATFORM_ORDER: readonly InsightsPlatform[] =
  INSIGHTS_PLATFORMS;

/** Standard: Gwada (eigene App-Kennzahlen), nicht „Alle“. */
export const INSIGHTS_PLATFORM_DEFAULT: InsightsPlatform = "gwada";

export function isInsightsPlatform(value: string): value is InsightsPlatform {
  return (INSIGHTS_PLATFORMS as readonly string[]).includes(value);
}

export function parseInsightsPlatform(
  platformParam: string | null | undefined,
): InsightsPlatform {
  if (platformParam && isInsightsPlatform(platformParam)) {
    return platformParam;
  }
  return INSIGHTS_PLATFORM_DEFAULT;
}
