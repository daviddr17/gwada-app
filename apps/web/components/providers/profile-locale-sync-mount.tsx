"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { readAppLocaleCookie, writeAppLocaleCookie } from "@/i18n/locale-cookie";
import { fetchProfileAppLocale } from "@/lib/i18n/apply-app-locale";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";

/**
 * After sign-in on a device without locale cookie: hydrate from `profiles.locale`.
 * Never overwrite an existing cookie (that caused iOS PWA to snap back to de).
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
      const cookieRaw = readAppLocaleCookie();
      if (cookieRaw) return;

      const profileLocale = await fetchProfileAppLocale();
      if (cancelled || !profileLocale) return;

      writeAppLocaleCookie(profileLocale);
      if (profileLocale !== locale) {
        router.refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, userId, locale, router]);

  return null;
}
