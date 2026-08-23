"use client";

import { useLayoutEffect } from "react";
import { useSoftNavLock } from "@/components/providers/soft-nav-lock-provider";
import { useAppModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { resolveDocumentPageTitle } from "@/lib/navigation/document-page-title";
import { normalizeNavHref } from "@/lib/navigation/soft-nav-lock-context";

/** Sofortiger Header-Titel bei Soft-Nav (bevor Ziel-Route mountet). */
export function SuperadminSpaPendingChromeSync() {
  const { pendingHref } = useSoftNavLock();
  const { setChrome } = useAppModuleChrome();

  useLayoutEffect(() => {
    if (!pendingHref) return;
    const path = normalizeNavHref(pendingHref).split("?")[0];
    const title = resolveDocumentPageTitle(path);
    if (!title) return;
    setChrome((prev) => ({ ...prev, title }));
  }, [pendingHref, setChrome]);

  return null;
}
