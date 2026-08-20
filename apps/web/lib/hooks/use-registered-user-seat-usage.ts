"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { registeredUserSeatCap } from "@/lib/billing/registered-user-seats";
import { useRestaurantBilling } from "@/lib/contexts/restaurant-billing-context";
import { useRestaurantPendingStaffInvites } from "@/lib/hooks/use-restaurant-pending-staff-invites";
import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type RegisteredUserSeatUsage = {
  cap: number | null;
  used: number;
  atLimit: boolean;
  loading: boolean;
  pendingStaffIds: ReadonlySet<string>;
};

export function useRegisteredUserSeatUsage(
  restaurantId: string | null,
): RegisteredUserSeatUsage {
  const { entitlements, loading: billingLoading } = useRestaurantBilling();
  const cap = billingLoading ? null : registeredUserSeatCap(entitlements);
  const { invites, loading: invitesLoading } =
    useRestaurantPendingStaffInvites(restaurantId);
  const [activeLogins, setActiveLogins] = useState(0);
  const [countLoading, setCountLoading] = useState(true);

  const refreshCount = useCallback(async () => {
    if (!restaurantId) {
      setActiveLogins(0);
      setCountLoading(false);
      return;
    }
    setCountLoading(true);
    const sb = createSupabaseBrowserClient();
    const { count, error } = await sb
      .from("restaurant_employees")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true);
    if (error) {
      console.warn("useRegisteredUserSeatUsage", error.message);
      setActiveLogins(0);
    } else {
      setActiveLogins(count ?? 0);
    }
    setCountLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const onRefresh = () => void refreshCount();
    window.addEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
  }, [refreshCount]);

  const pendingStaffIds = useMemo(
    () => new Set(invites.map((row) => row.staff_id).filter(Boolean)),
    [invites],
  );

  const used = activeLogins + invites.length;
  const loading = billingLoading || invitesLoading || countLoading;

  return {
    cap,
    used,
    atLimit: cap != null && used >= cap,
    loading,
    pendingStaffIds,
  };
}
