"use client";

import { useEffect, useRef } from "react";
import {
  applyUiDensity,
  fetchProfileUiDensity,
} from "@/lib/ui/apply-ui-density";
import {
  applyUiDensityToDocument,
  normalizeUiDensity,
  readUiDensityCookieFromDocument,
} from "@/lib/ui/ui-density";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";

/**
 * Once per sign-in: `profiles.ui_density` is the account source of truth.
 * Cookie covers first paint; this reconciles after auth.
 */
export function ProfileUiDensitySyncMount() {
  const { user, ready } = useWorkspaceAuthSession();
  const userId = user?.id ?? null;
  const syncedForUser = useRef<string | null>(null);

  useEffect(() => {
    const cookieDensity = readUiDensityCookieFromDocument();
    if (cookieDensity) {
      applyUiDensityToDocument(cookieDensity);
    }
  }, []);

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
      const profileDensity = await fetchProfileUiDensity();
      if (cancelled || !profileDensity) return;

      const cookieDensity = readUiDensityCookieFromDocument();
      if (cookieDensity === profileDensity) {
        applyUiDensityToDocument(profileDensity);
        return;
      }

      const result = await applyUiDensity(profileDensity);
      if (cancelled || !result.ok) {
        applyUiDensityToDocument(normalizeUiDensity(profileDensity));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, userId]);

  return null;
}
