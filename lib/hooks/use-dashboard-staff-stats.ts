"use client";

import { useEffect, useState } from "react";
import type { DashboardStaffSummary } from "@/lib/staff/compute-dashboard-staff-summary";
import type { DashboardStaffSummaryPayload } from "@/lib/dashboard/dashboard-staff-summary-types";
import { fetchDashboardSummaryClient } from "@/lib/dashboard/fetch-dashboard-summary-client";
import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type {
  RestaurantStaffRow,
  StaffLivePresenceRow,
} from "@/lib/types/staff";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export function useDashboardStaffStats() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [summary, setSummary] = useState<DashboardStaffSummary | null>(null);
  const [staff, setStaff] = useState<RestaurantStaffRow[]>([]);
  const [presence, setPresence] = useState<StaffLivePresenceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) {
      setSummary(null);
      setStaff([]);
      setPresence([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancel = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } =
        await fetchDashboardSummaryClient<DashboardStaffSummaryPayload>(
          "/api/dashboard/staff/summary",
          restaurantId,
        );
      if (cancel) return;
      setLoading(false);
      if (err) {
        setSummary(null);
        setStaff([]);
        setPresence([]);
        setError(err);
        return;
      }
      setSummary(data?.summary ?? null);
      setStaff(data?.staff ?? []);
      setPresence(data?.presence ?? []);
    };

    void run();

    const onRefresh = () => void run();
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onRefresh);
    window.addEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
    return () => {
      cancel = true;
      window.removeEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onRefresh);
      window.removeEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
    };
  }, [restaurantId]);

  return {
    summary,
    staff,
    presence,
    loading,
    error,
    ready: workspaceReady && Boolean(restaurantId && isUuidRestaurantId(restaurantId)),
  };
}
