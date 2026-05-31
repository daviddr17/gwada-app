"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { formatDocumentTitle } from "@/lib/constants/document-title";
import { resolveDocumentPageTitle } from "@/lib/navigation/document-page-title";
import { useAppModuleChromeOptional } from "@/lib/contexts/app-module-chrome-context";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";

const EMPTY_CHROME = { title: "", subnav: null } as const;

/** Feste Seite (Login, Landing ohne App-Shell). */
export function DocumentTitle({ pageTitle }: { pageTitle: string }) {
  const branding = usePlatformAppBrandingOptional();
  const brandName = branding?.appName;
  useEffect(() => {
    document.title = formatDocumentTitle(pageTitle, brandName);
  }, [pageTitle, brandName]);
  return null;
}

/** Tab-Titel aus Modul-Chrome + Route (innerhalb App-Shell). */
export function DocumentTitleSync() {
  const pathname = usePathname();
  const chrome = useAppModuleChromeOptional();
  const branding = usePlatformAppBrandingOptional();

  const pageTitle = useMemo(
    () => resolveDocumentPageTitle(pathname, chrome ?? EMPTY_CHROME),
    [pathname, chrome],
  );

  useEffect(() => {
    document.title = formatDocumentTitle(pageTitle, branding?.appName);
  }, [pageTitle, branding?.appName]);

  return null;
}
