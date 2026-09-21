"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import {
  DEFAULT_PROFILE_VISIBILITY,
  parseProfileVisibility,
  type ProfileVisibilitySettings,
} from "@/lib/profile/profile-nav";
import { queryKeys } from "@/lib/query/query-keys";
import { fetchStaffModuleSettings } from "@/lib/supabase/staff-module-settings-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

const VISIBILITY_STALE_MS = 60_000;
const VISIBILITY_GC_MS = 5 * 60_000;

export function useStaffProfileVisibility() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const queryClient = useQueryClient();
  const enabled = workspaceReady && Boolean(restaurantId);

  const query = useQuery({
    queryKey: queryKeys.staff.profileVisibility(restaurantId ?? ""),
    queryFn: async (): Promise<ProfileVisibilitySettings> => {
      const { data, error } = await fetchStaffModuleSettings(restaurantId!);
      if (error) return DEFAULT_PROFILE_VISIBILITY;
      return parseProfileVisibility(data);
    },
    enabled,
    staleTime: VISIBILITY_STALE_MS,
    gcTime: VISIBILITY_GC_MS,
    refetchOnWindowFocus: false,
  });

  const loading = !workspaceReady || (enabled && query.isLoading);

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.staff.profileVisibility(restaurantId),
    });
  }, [queryClient, restaurantId]);

  useEffect(() => {
    const onChange = () => void reload();
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onChange,
      );
  }, [reload]);

  return {
    restaurantId,
    workspaceReady,
    visibility: query.data ?? DEFAULT_PROFILE_VISIBILITY,
    loading,
    reload,
  };
}
