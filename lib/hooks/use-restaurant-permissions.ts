"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ALL_RESTAURANT_PERMISSION_KEYS,
  type RestaurantPermissionKey,
} from "@/lib/permissions/restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export function useRestaurantPermissions() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!workspaceReady) return;

    const sb = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      setPermissions(new Set());
      setLoading(false);
      return;
    }
    if (!restaurantId) {
      setPermissions(new Set());
      setLoading(false);
      return;
    }
    const [{ data, error }, { data: employee }] = await Promise.all([
      sb.rpc("auth_user_restaurant_permission_keys", {
        p_restaurant_id: restaurantId,
      }),
      sb
        .from("restaurant_employees")
        .select("role, restaurant_positions(slug)")
        .eq("restaurant_id", restaurantId)
        .eq("profile_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    if (error) {
      console.warn("auth_user_restaurant_permission_keys", error.message);
      setPermissions(new Set());
    } else {
      const keys = new Set((data as string[] | null) ?? []);
      const positionSlug = (
        employee as { restaurant_positions?: { slug?: string } | null } | null
      )?.restaurant_positions?.slug;
      const employeeRole = (employee as { role?: string } | null)?.role;
      if (positionSlug === "owner" || employeeRole === "owner") {
        for (const k of ALL_RESTAURANT_PERMISSION_KEYS) {
          keys.add(k);
        }
      }
      setPermissions(keys);
    }
    setLoading(false);
  }, [workspaceReady, restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = () => void reload();
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
  }, [reload]);

  const has = useCallback(
    (key: RestaurantPermissionKey) => permissions.has(key),
    [permissions],
  );

  return {
    restaurantId,
    permissions,
    has,
    loading: !workspaceReady || loading,
    workspaceReady,
    reload,
  };
}
