"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { queryKeys } from "@/lib/query/query-keys";
import { fetchStaffByProfileForRestaurant } from "@/lib/supabase/staff-db";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";
import type { RestaurantStaffRow } from "@/lib/types/staff";

const MY_STAFF_STALE_MS = 60_000;
const MY_STAFF_GC_MS = 5 * 60_000;

export function useMyRestaurantStaff() {
  const { user, ready: authReady } = useWorkspaceAuthSession();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const enabled = authReady && workspaceReady && Boolean(restaurantId) && Boolean(userId);

  const query = useQuery({
    queryKey: queryKeys.staff.myProfile(restaurantId ?? "", userId ?? ""),
    queryFn: async (): Promise<RestaurantStaffRow | null> => {
      const { data, error } = await fetchStaffByProfileForRestaurant(
        restaurantId!,
        userId!,
      );
      if (error) throw new Error(error);
      return data;
    },
    enabled,
    staleTime: MY_STAFF_STALE_MS,
    gcTime: MY_STAFF_GC_MS,
    refetchOnWindowFocus: false,
  });

  const loading = !authReady || !workspaceReady || (enabled && query.isLoading);
  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    if (!restaurantId || !userId) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.staff.myProfile(restaurantId, userId),
    });
  }, [queryClient, restaurantId, userId]);

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
    staff: query.data ?? null,
    staffId: query.data?.id ?? null,
    loading,
    showSkeleton,
    reload,
  };
}
