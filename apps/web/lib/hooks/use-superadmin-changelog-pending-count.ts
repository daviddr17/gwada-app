"use client";

import { useCallback, useEffect, useState } from "react";
import { GWADA_SUPERADMIN_CHANGELOG_REFRESH_EVENT } from "@/lib/changelog/changelog-events";
import { fetchSuperadminChangelogPendingCount } from "@/lib/superadmin/platform-changelog-api";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";

const REFETCH_MS = 60_000;

export function useSuperadminChangelogPendingCount(enabled = true) {
  const { isSuperadmin } = useIsSuperadmin();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled || !isSuperadmin) {
      setCount(0);
      return;
    }
    const { count: next, error } = await fetchSuperadminChangelogPendingCount();
    if (!error) setCount(next);
  }, [enabled, isSuperadmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !isSuperadmin) return;

    const onRefresh = () => {
      void refresh();
    };

    window.addEventListener(GWADA_SUPERADMIN_CHANGELOG_REFRESH_EVENT, onRefresh);

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }, REFETCH_MS);

    return () => {
      window.removeEventListener(
        GWADA_SUPERADMIN_CHANGELOG_REFRESH_EVENT,
        onRefresh,
      );
      window.clearInterval(interval);
    };
  }, [enabled, isSuperadmin, refresh]);

  return { count, refresh };
}
