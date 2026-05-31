import { isTestEnvironment } from "@/lib/constants/app-environment";

import { DEFAULT_PLATFORM_APP_NAME } from "@/lib/types/platform-app-settings";

/** Fallback, wenn Plattform-Branding noch nicht geladen ist. */
export const DOCUMENT_TITLE_BRAND = DEFAULT_PLATFORM_APP_NAME;

/** Browser-Tab: `{brand} - Seite` (+ ` - Testumgebung` in der Dev-Testumgebung). */
export function formatDocumentTitle(
  pageTitle: string,
  brandName: string = DOCUMENT_TITLE_BRAND,
): string {
  const brand = brandName.trim() || DOCUMENT_TITLE_BRAND;
  const page = pageTitle.trim();
  const core = page ? `${brand} - ${page}` : brand;
  if (isTestEnvironment()) {
    return `${core} - Testumgebung`;
  }
  return core;
}
