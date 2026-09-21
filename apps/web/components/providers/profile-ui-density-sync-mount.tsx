"use client";

import { useEffect, useRef } from "react";
import {
  applyUiDensity,
  fetchProfileUiDensity,
  hydrateUiDensityFromLocalStore,
} from "@/lib/ui/apply-ui-density";
import { applyUiDensityToDocument } from "@/lib/ui/ui-density";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";

/**
 * Local cookie/storage first (works without Live-DB column).
 * If/when `profiles.ui_density` exists, reconcile once per sign-in.
 */
export function ProfileUiDensitySyncMount() {
  const { user, ready } = useWorkspaceAuthSession();
  const userId = user?.id ?? null;
  const syncedForUser = useRef<string | null>(null);

  useEffect(() => {
    hydrateUiDensityFromLocalStore();
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
      applyUiDensityToDocument(profileDensity);
      // Best-effort sync cookie; never fails UX if DB column missing.
      void applyUiDensity(profileDensity);
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, userId]);

  return null;
}
