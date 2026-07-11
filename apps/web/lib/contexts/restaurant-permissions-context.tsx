"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ALL_RESTAURANT_PERMISSION_KEYS,
  type RestaurantPermissionKey,
} from "@/lib/permissions/restaurant-permissions";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { useWorkspaceRestaurantContext } from "@/lib/contexts/workspace-restaurant-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
  peekCachedWorkspaceRestaurantSession,
} from "@/lib/supabase/workspace-persistence";

const PERMISSIONS_RETRY_DELAYS_MS = [800, 1600, 3200] as const;
const PERMISSIONS_SESSION_CACHE_KEY = "gwada-restaurant-permissions-v1";

function permissionsCacheKey(restaurantId: string, userId: string): string {
  return `${userId}:${restaurantId}`;
}

function readInitialPermissionsCache(): Set<string> {
  const session = peekCachedWorkspaceRestaurantSession();
  if (!session) return new Set();
  return (
    readPermissionsSessionCache(session.restaurantId, session.userKey) ??
    new Set()
  );
}

function readPermissionsSessionCache(
  restaurantId: string,
  userId: string,
): Set<string> | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PERMISSIONS_SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const keys = parsed[permissionsCacheKey(restaurantId, userId)];
    if (!Array.isArray(keys) || keys.length === 0) return null;
    return new Set(keys);
  } catch {
    return null;
  }
}

function writePermissionsSessionCache(
  restaurantId: string,
  userId: string,
  keys: Set<string>,
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = sessionStorage.getItem(PERMISSIONS_SESSION_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    parsed[permissionsCacheKey(restaurantId, userId)] = [...keys];
    sessionStorage.setItem(PERMISSIONS_SESSION_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export type RestaurantPermissionsValue = {
  restaurantId: string | null;
  permissions: Set<string>;
  has: (key: RestaurantPermissionKey) => boolean;
  loading: boolean;
  error: string | null;
  workspaceReady: boolean;
  reload: () => Promise<void>;
};

const RestaurantPermissionsContext =
  createContext<RestaurantPermissionsValue | null>(null);

function useRestaurantPermissionsState(): RestaurantPermissionsValue {
  const { user, ready: authReady } = useWorkspaceAuthSession();
  const {
    restaurantId,
    ready: workspaceReady,
  } = useWorkspaceRestaurantContext();
  const [permissions, setPermissions] = useState(readInitialPermissionsCache);
  const [loading, setLoading] = useState(
    () => readInitialPermissionsCache().size === 0,
  );
  const [error, setError] = useState<string | null>(null);
  const reloadGeneration = useRef(0);
  const hydratedCacheRef = useRef(readInitialPermissionsCache().size > 0);

  useLayoutEffect(() => {
    if (!authReady || !workspaceReady || !user || !restaurantId) return;
    if (hydratedCacheRef.current) return;
    const cached = readPermissionsSessionCache(restaurantId, user.id);
    if (cached) {
      hydratedCacheRef.current = true;
      setPermissions(cached);
      setLoading(false);
    }
  }, [authReady, workspaceReady, user, restaurantId]);

  const reload = useCallback(async () => {
    if (!workspaceReady || !authReady) return;

    const generation = ++reloadGeneration.current;
    const hadCached =
      user != null &&
      restaurantId != null &&
      Boolean(readPermissionsSessionCache(restaurantId, user.id));
    if (!hadCached) {
      setLoading(true);
    }
    setError(null);

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

    const sb = createSupabaseBrowserClient();
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
        writePermissionsSessionCache(restaurantId, user.id, keys);
        return;
      }

      lastError = rpcError.message;
      console.warn(
        "auth_user_restaurant_permission_keys",
        rpcError.message,
        `(Versuch ${attempt + 1}/${maxAttempts})`,
      );
    }

    setError(lastError ?? "Berechtigungen konnten nicht geladen werden.");
    setLoading(false);
  }, [authReady, user, workspaceReady, restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = () => {
      hydratedCacheRef.current = false;
      void reload();
    };
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
  }, [reload]);

  const has = useCallback(
    (key: RestaurantPermissionKey) => permissions.has(key),
    [permissions],
  );

  const blockingLoad =
    permissions.size === 0 && (!workspaceReady || !authReady || loading);

  return useMemo(
    () => ({
      restaurantId,
      permissions,
      has,
      loading: blockingLoad,
      error,
      workspaceReady: workspaceReady && authReady,
      reload,
    }),
    [
      restaurantId,
      permissions,
      has,
      workspaceReady,
      authReady,
      blockingLoad,
      error,
      reload,
    ],
  );
}

export function RestaurantPermissionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = useRestaurantPermissionsState();
  return (
    <RestaurantPermissionsContext.Provider value={value}>
      {children}
    </RestaurantPermissionsContext.Provider>
  );
}

export function useRestaurantPermissionsContext(): RestaurantPermissionsValue {
  const ctx = useContext(RestaurantPermissionsContext);
  if (!ctx) {
    throw new Error(
      "useRestaurantPermissionsContext erfordert RestaurantPermissionsProvider.",
    );
  }
  return ctx;
}
