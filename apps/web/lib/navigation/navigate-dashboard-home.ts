"use client";

import { waitForAppPath } from "@/lib/navigation/soft-nav-queue";

type AppRouterReplace = {
  replace: (href: string) => void;
  refresh: () => void;
};

async function cleanupAuthCookiesBeforeNav(): Promise<void> {
  try {
    await fetch("/api/auth/cleanup-cookies", { credentials: "include" });
  } catch {
    // Proxy strippt gwada_* trotzdem serverseitig.
  }
}

/** Modul → Dashboard: Cookies bereinigen, RSC-Flight serialisieren, bei Bedarf retry. */
export async function navigateDashboardHome(
  router: AppRouterReplace,
  hrefStr: string,
): Promise<void> {
  await cleanupAuthCookiesBeforeNav();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    router.replace(hrefStr);
    const settled = await waitForAppPath(hrefStr);
    if (settled) return;
    await cleanupAuthCookiesBeforeNav();
    router.refresh();
  }
}
