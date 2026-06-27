"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALL_RESTAURANT_PERMISSION_KEYS,
  type RestaurantPermissionKey,
} from "@/lib/permissions/restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

const PERMISSIONS_RETRY_DELAYS_MS = [800, 1600, 3200] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useRestaurantPermissions() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reloadGeneration = useRef(0);

  const reload = useCallback(async () => {
    if (!workspaceReady) return;

    const generation = ++reloadGeneration.current;
    setLoading(true);
    setError(null);

    const sb = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (generation !== reloadGeneration.current) return;

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

    const maxAttempts = 1 + PERMISSIONS_RETRY_DELAYS_MS.length;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await sleep(PERMISSIONS_RETRY_DELAYS_MS[attempt - 1] ?? 3200);
        if (generation !== reloadGeneration.current) return;
      }

      const [{ data, error: rpcError }, { data: employee }] = await Promise.all([
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

      if (generation !== reloadGeneration.current) return;

      if (!rpcError) {
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
        setError(null);
        setLoading(false);
        return;
      }

      lastError = rpcError.message;
      console.warn(
        "auth_user_restaurant_permission_keys",
        rpcError.message,
        `(Versuch ${attempt + 1}/${maxAttempts})`,
      );
    }

    setError(
      lastError ?? "Berechtigungen konnten nicht geladen werden.",
    );
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
    error,
    workspaceReady,
    reload,
  };
}
