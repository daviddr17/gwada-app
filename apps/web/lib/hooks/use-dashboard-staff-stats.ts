"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardStaffSummary } from "@/lib/staff/compute-dashboard-staff-summary";
import type { DashboardStaffSummaryPayload } from "@/lib/dashboard/dashboard-staff-summary-types";
import { fetchDashboardSummaryClient } from "@/lib/dashboard/fetch-dashboard-summary-client";
import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";
import {
  GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT,
  useDashboardHasDataRef,
} from "@/lib/dashboard/dashboard-widget-refresh";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type {
  RestaurantStaffRow,
  StaffLivePresenceRow,
} from "@/lib/types/staff";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export function useDashboardStaffStats() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const hasDataRef = useDashboardHasDataRef();
  const [summary, setSummary] = useState<DashboardStaffSummary | null>(null);
  const [staff, setStaff] = useState<RestaurantStaffRow[]>([]);
  const [presence, setPresence] = useState<StaffLivePresenceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (silent: boolean) => {
      if (!restaurantId || !isUuidRestaurantId(restaurantId)) return;

      const initial = !hasDataRef.current;
      if (!silent && initial) setLoading(true);
      if (!silent) setError(null);

      const { data, error: err } =
        await fetchDashboardSummaryClient<DashboardStaffSummaryPayload>(
          "/api/dashboard/staff/summary",
          restaurantId,
        );

      if (err) {
        if (!hasDataRef.current) {
          setSummary(null);
          setStaff([]);
          setPresence([]);
          setError(err);
        }
        if (!silent && initial) setLoading(false);
        return;
      }

      setSummary(data?.summary ?? null);
      setStaff(data?.staff ?? []);
      setPresence(data?.presence ?? []);
      hasDataRef.current = Boolean(data?.summary);
      if (!silent && initial) setLoading(false);
    },
    [restaurantId, hasDataRef],
  );

  useEffect(() => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) {
      hasDataRef.current = false;
      setSummary(null);
      setStaff([]);
      setPresence([]);
      setError(null);
      setLoading(false);
      return;
    }

    hasDataRef.current = false;
    void run(false);

    const onPoll = () => void run(true);
    const onRestaurantChange = () => {
      hasDataRef.current = false;
      void run(false);
    };

    window.addEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, onPoll);
    window.addEventListener(
      GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
      onRestaurantChange,
    );
    window.addEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onPoll);

    return () => {
      window.removeEventListener(GWADA_DASHBOARD_WIDGETS_REFRESH_EVENT, onPoll);
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onRestaurantChange,
      );
      window.removeEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onPoll);
    };
  }, [restaurantId, run, hasDataRef]);

  return {
    summary,
    staff,
    presence,
    loading,
    error,
    ready: workspaceReady && Boolean(restaurantId && isUuidRestaurantId(restaurantId)),
  };
}
