"use client";

import { useCallback, useEffect, useState } from "react";
import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";

export type RestaurantPendingStaffInviteRow = {
  invite_id: string;
  staff_id: string;
  staff_given_name: string | null;
  staff_family_name: string | null;
  staff_email: string | null;
  staff_phone: string | null;
  position_name: string | null;
  channel: string;
  expires_at: string;
  created_at: string;
};

export function useRestaurantPendingStaffInvites(restaurantId: string | null) {
  const [invites, setInvites] = useState<RestaurantPendingStaffInviteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!restaurantId) {
      setInvites([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/staff/pending-invites?restaurant_id=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setInvites([]);
        return;
      }
      const data = (await res.json()) as {
        invites?: RestaurantPendingStaffInviteRow[];
      };
      setInvites(data.invites ?? []);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onRefresh = () => void refresh();
    window.addEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
  }, [refresh]);

  return { invites, loading, refresh };
}
