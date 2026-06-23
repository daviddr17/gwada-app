"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_PROFILE_VISIBILITY,
  parseProfileVisibility,
  type ProfileVisibilitySettings,
} from "@/lib/profile/profile-nav";
import { fetchStaffModuleSettings } from "@/lib/supabase/staff-module-settings-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export function useStaffProfileVisibility() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [visibility, setVisibility] =
    useState<ProfileVisibilitySettings>(DEFAULT_PROFILE_VISIBILITY);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!restaurantId) {
      setVisibility(DEFAULT_PROFILE_VISIBILITY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await fetchStaffModuleSettings(restaurantId);
    setLoading(false);
    if (error) {
      setVisibility(DEFAULT_PROFILE_VISIBILITY);
      return;
    }
    setVisibility(parseProfileVisibility(data));
  }, [restaurantId]);

  useEffect(() => {
    if (!workspaceReady) return;
    void reload();
  }, [workspaceReady, reload]);

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
    visibility,
    loading,
    reload,
  };
}
