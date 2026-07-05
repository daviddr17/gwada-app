"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchStaffByProfileForRestaurant } from "@/lib/supabase/staff-db";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";
import type { RestaurantStaffRow } from "@/lib/types/staff";

export function useMyRestaurantStaff() {
  const { user, ready: authReady } = useWorkspaceAuthSession();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [staff, setStaff] = useState<RestaurantStaffRow | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    if (!authReady || !workspaceReady) return;
    if (!restaurantId || !user) {
      setStaff(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await fetchStaffByProfileForRestaurant(
      restaurantId,
      user.id,
    );
    setLoading(false);
    if (error) {
      setStaff(null);
      return;
    }
    setStaff(data);
  }, [authReady, workspaceReady, restaurantId, user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = () => {
      void reload();
    };
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onChange,
      );
    };
  }, [reload]);

  return {
    restaurantId,
    workspaceReady,
    staff,
    staffId: staff?.id ?? null,
    loading,
    showSkeleton,
    reload,
  };
}
