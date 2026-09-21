"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { normalizeAppLocale } from "@/i18n/config";
import { readAppLocaleCookie } from "@/i18n/locale-cookie";
import {
  applyAppLocale,
  fetchProfileAppLocale,
} from "@/lib/i18n/apply-app-locale";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";

/**
 * Once per sign-in: `profiles.locale` is the account source of truth.
 * Reconcile stale/missing cookies via API (Set-Cookie), not only document.cookie.
 */
export function ProfileLocaleSyncMount() {
  const locale = useLocale();
  const router = useRouter();
  const { user, ready } = useWorkspaceAuthSession();
  const userId = user?.id ?? null;
  const syncedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      syncedForUser.current = null;
      return;
    }
    if (syncedForUser.current === userId) return;
    syncedForUser.current = userId;

    let cancelled = false;
    void (async () => {
      const profileLocale = await fetchProfileAppLocale();
      if (cancelled || !profileLocale) return;

      const cookieRaw = readAppLocaleCookie();
      const cookieLocale = cookieRaw ? normalizeAppLocale(cookieRaw) : null;
      if (cookieLocale === profileLocale && profileLocale === normalizeAppLocale(locale)) {
        return;
      }

      const result = await applyAppLocale(profileLocale);
      if (cancelled || !result.ok) return;

      if (profileLocale !== normalizeAppLocale(locale)) {
        router.refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, userId, locale, router]);

  return null;
}
