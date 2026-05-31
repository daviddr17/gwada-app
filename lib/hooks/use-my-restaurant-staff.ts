"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchStaffByProfileForRestaurant } from "@/lib/supabase/staff-db";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";
import type { RestaurantStaffRow } from "@/lib/types/staff";

export function useMyRestaurantStaff() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [staff, setStaff] = useState<RestaurantStaffRow | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    if (!restaurantId) {
      setStaff(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStaff(null);
      setLoading(false);
      return;
    }
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
  }, [restaurantId]);

  useEffect(() => {
    if (!workspaceReady) return;
    void reload();
  }, [workspaceReady, reload]);

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
