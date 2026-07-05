"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
} from "@/lib/supabase/workspace-persistence";

export function useWorkspaceActiveRole() {
  const { user, ready: authReady } = useWorkspaceAuthSession();
  const { restaurantId, ready: workspaceReady, refresh: refreshRestaurant } =
    useWorkspaceRestaurantUuid();
  const [role, setRole] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!authReady || !workspaceReady) return;
    if (!user || !restaurantId) {
      setRole(null);
      return;
    }
    const sb = createSupabaseBrowserClient();
    const { data } = await sb
      .from("restaurant_employees")
      .select("role")
      .eq("restaurant_id", restaurantId)
      .eq("profile_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    setRole((data?.role as string | undefined) ?? null);
  }, [authReady, workspaceReady, user, restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = () => {
      void refreshRestaurant();
      void reload();
    };
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
  }, [reload, refreshRestaurant]);

  return { restaurantId, role, reload };
}
