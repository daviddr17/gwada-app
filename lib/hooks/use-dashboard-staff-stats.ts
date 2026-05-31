"use client";

import { useCallback, useEffect, useState } from "react";
import {
  computeDashboardStaffSummary,
  type DashboardStaffSummary,
} from "@/lib/staff/compute-dashboard-staff-summary";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayStartToUtcIso,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import {
  fetchStaffForRestaurant,
  fetchStaffLivePresence,
  fetchStaffWorkEntriesInRange,
} from "@/lib/supabase/staff-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

const REFRESH_MS = 30_000;

export function useDashboardStaffStats() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [summary, setSummary] = useState<DashboardStaffSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) {
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const today = startOfLocalDay(new Date());
    const rangeStart = localDayStartToUtcIso(today);
    const rangeEnd = exclusiveUtcIsoAfterLocalVisibleEnd(today);

    const [staffRes, presenceRes, entriesRes] = await Promise.all([
      fetchStaffForRestaurant(restaurantId),
      fetchStaffLivePresence(restaurantId),
      fetchStaffWorkEntriesInRange(restaurantId, null, rangeStart, rangeEnd),
    ]);

    setLoading(false);

    const err =
      staffRes.error ?? presenceRes.error ?? entriesRes.error ?? null;
    if (err) {
      setSummary(null);
      setError(err);
      return;
    }

    setSummary(
      computeDashboardStaffSummary({
        staff: staffRes.data,
        presence: presenceRes.data,
        todayEntries: entriesRes.data,
      }),
    );
  }, [restaurantId]);

  useEffect(() => {
    void run();
    const id = setInterval(() => void run(), REFRESH_MS);
    const onChange = () => void run();
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    return () => {
      clearInterval(id);
      window.removeEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    };
  }, [run]);

  return {
    summary,
    loading,
    error,
    ready: workspaceReady && Boolean(restaurantId && isUuidRestaurantId(restaurantId)),
  };
}
