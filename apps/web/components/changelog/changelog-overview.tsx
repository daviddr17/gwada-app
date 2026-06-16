"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChangelogEntryCard } from "@/components/changelog/changelog-entry-card";
import { ChangelogOverviewSkeleton } from "@/components/changelog/changelog-overview-skeleton";
import { markAllChangelogReadClient } from "@/lib/changelog/fetch-changelog-read-client";
import { parseChangelogBody } from "@/lib/changelog/changelog-body-sections";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { fetchPlatformChangelogEntries } from "@/lib/supabase/platform-changelog-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PlatformChangelogEntry } from "@/lib/types/platform-changelog";

export function ChangelogOverview() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { isSuperadmin } = useIsSuperadmin();
  const [entries, setEntries] = useState<PlatformChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadSucceeded, setLoadSucceeded] = useState(false);
  const readAllStartedRef = useRef<string | null>(null);
  const showSkeleton = useDeferredSkeleton(loading && entries.length === 0);

  const visibleEntries = useMemo(() => {
    if (isSuperadmin) return entries;
    return entries.filter((entry) => {
      if (entry.audience === "superadmin") return false;
      return parseChangelogBody(entry.body).customerBody.trim().length > 0;
    });
  }, [entries, isSuperadmin]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadSucceeded(false);
    const sb = createSupabaseBrowserClient();
    const { entries: data, error } = await fetchPlatformChangelogEntries(sb);
    if (error) {
      toast.error(error);
      setEntries(data);
      setLoading(false);
      return;
    }
    setEntries(data);
    setLoadSucceeded(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!ready || !restaurantId || !loadSucceeded) return;
    if (readAllStartedRef.current === restaurantId) return;
    readAllStartedRef.current = restaurantId;
    void markAllChangelogReadClient(restaurantId);
  }, [ready, restaurantId, loadSucceeded]);

  if (showSkeleton) {
    return <ChangelogOverviewSkeleton />;
  }

  if (!loading && visibleEntries.length === 0) {
    return (
      <p className="rounded-2xl border border-border/50 bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-card">
        Noch keine Einträge — neue Funktionen erscheinen hier nach dem nächsten
        Update.
      </p>
    );
  }

  if (loading && entries.length === 0) {
    return <div className="min-h-[12rem]" aria-busy="true" />;
  }

  return (
    <div className="space-y-4">
      {visibleEntries.map((entry) => (
        <ChangelogEntryCard
          key={entry.id}
          entry={entry}
          showSuperadminSections={isSuperadmin}
        />
      ))}
    </div>
  );
}
