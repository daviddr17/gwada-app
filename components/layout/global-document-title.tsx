"use client";

import { useLayoutEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  DOCUMENT_TITLE_BRAND,
  formatDocumentTitle,
} from "@/lib/constants/document-title";
import { useDocumentTitleOverrideOptional } from "@/lib/contexts/document-title-override-context";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { resolveDocumentPageTitle } from "@/lib/navigation/document-page-title";

/** Einheitlicher Tab-Titel app-weit: `gwada - Segment1 - Segment2`. */
export function GlobalDocumentTitle() {
  const pathname = usePathname();
  const branding = usePlatformAppBrandingOptional();
  const titleOverride = useDocumentTitleOverrideOptional();
  const brandName = branding?.appName?.trim() || DOCUMENT_TITLE_BRAND;

  const pageTitle = useMemo(() => {
    if (titleOverride?.override?.trim()) {
      return titleOverride.override.trim();
    }
    return resolveDocumentPageTitle(pathname);
  }, [pathname, titleOverride?.override]);

  useLayoutEffect(() => {
    document.title = formatDocumentTitle(pageTitle, brandName);
  }, [pageTitle, brandName]);

  return null;
}
