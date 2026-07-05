import {
  mergeDashboardShortcutVisibility,
  normalizeShortcutOrder,
  shortcutVisibilityPatchFromStored,
} from "@/lib/constants/dashboard-shortcuts";
import {
  DASHBOARD_WIDGET_STORAGE_KEY,
  canonicalDashboardWidgetId,
  defaultDashboardWidgetPrefs,
  mergeDashboardWidgetVisibility,
  normalizeWidgetOrder,
  visibilityPatchFromStored,
  type DashboardWidgetPrefs,
} from "@/lib/constants/dashboard-widgets";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { RawDashboardWidgetRow } from "@/lib/supabase/user-restaurant-dashboard-widgets";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  peekCachedWorkspaceRestaurantSession,
  workspacePersistenceConfigured,
} from "@/lib/supabase/workspace-persistence";

function isLegacyFlatVisibility(parsed: Record<string, unknown>): boolean {
  const keys = Object.keys(parsed);
  if (keys.length === 0) return false;
  return keys.every(
    (k) =>
      canonicalDashboardWidgetId(k) != null && typeof parsed[k] === "boolean",
  );
}

function parseShortcutsFromObject(
  o: Record<string, unknown>,
): DashboardWidgetPrefs["shortcuts"] {
  const shortcutsRaw =
    o.shortcuts && typeof o.shortcuts === "object" && !Array.isArray(o.shortcuts)
      ? (o.shortcuts as Record<string, unknown>)
      : null;
  const visRaw =
    shortcutsRaw?.visibility &&
    typeof shortcutsRaw.visibility === "object" &&
    !Array.isArray(shortcutsRaw.visibility)
      ? (shortcutsRaw.visibility as Record<string, unknown>)
      : typeof o.shortcutVisibility === "object" &&
          o.shortcutVisibility &&
          !Array.isArray(o.shortcutVisibility)
        ? (o.shortcutVisibility as Record<string, unknown>)
        : {};
  const orderRaw = shortcutsRaw?.order ?? o.shortcutOrder ?? o.shortcut_order;
  return {
    visibility: mergeDashboardShortcutVisibility(
      shortcutVisibilityPatchFromStored(visRaw),
    ),
    order: normalizeShortcutOrder(orderRaw),
  };
}

export function parseStoredDashboardWidgetPrefs(
  raw: string | null,
): DashboardWidgetPrefs {
  const fallback = defaultDashboardWidgetPrefs();
  if (!raw?.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fallback;
    }
    const o = parsed as Record<string, unknown>;

    if (isLegacyFlatVisibility(o)) {
      return {
        visibility: mergeDashboardWidgetVisibility(visibilityPatchFromStored(o)),
        order: normalizeWidgetOrder(o.order ?? []),
        shortcuts: parseShortcutsFromObject(o),
      };
    }

    const visRaw =
      o.visibility && typeof o.visibility === "object" && !Array.isArray(o.visibility)
        ? (o.visibility as Record<string, unknown>)
        : {};

    return {
      visibility: mergeDashboardWidgetVisibility(visibilityPatchFromStored(visRaw)),
      order: normalizeWidgetOrder(o.order),
      shortcuts: parseShortcutsFromObject(o),
    };
  } catch {
    return fallback;
  }
}

function parseFromRemote(remote: unknown): DashboardWidgetPrefs | null {
  if (!remote || typeof remote !== "object" || Array.isArray(remote)) return null;
  return parseStoredDashboardWidgetPrefs(JSON.stringify(remote));
}

export function dashboardWidgetPrefsLocalCompositeKey(
  profileId: string,
  restaurantId: string,
): string {
  return `${DASHBOARD_WIDGET_STORAGE_KEY}:user:${profileId}:restaurant:${restaurantId}`;
}

export function normalizeDbDashboardWidgetRow(
  row: RawDashboardWidgetRow,
): DashboardWidgetPrefs {
  const visRaw =
    row.visibility && typeof row.visibility === "object"
      ? (row.visibility as Record<string, unknown>)
      : {};
  const shortcutVisRaw =
    row.shortcutVisibility && typeof row.shortcutVisibility === "object"
      ? row.shortcutVisibility
      : {};
  return {
    visibility: mergeDashboardWidgetVisibility(visibilityPatchFromStored(visRaw)),
    order: normalizeWidgetOrder(row.order),
    shortcuts: {
      visibility: mergeDashboardShortcutVisibility(
        shortcutVisibilityPatchFromStored(shortcutVisRaw),
      ),
      order: normalizeShortcutOrder(row.shortcutOrder),
    },
  };
}

/**
 * Synchroner Cache-Hit für sofortiges Dashboard-Rendering (vor Remote-Reconcile).
 * Spätere modul-spezifische Cache-Policies können hier oder in einem Registry ergänzt werden.
 */
export function peekOptimisticDashboardWidgetPrefs(): DashboardWidgetPrefs | null {
  if (typeof window === "undefined") return null;

  if (workspacePersistenceConfigured()) {
    const session = peekCachedWorkspaceRestaurantSession();
    if (session) {
      try {
        const raw = localStorage.getItem(
          dashboardWidgetPrefsLocalCompositeKey(
            session.userKey,
            session.restaurantId,
          ),
        );
        if (raw) return parseStoredDashboardWidgetPrefs(raw);
      } catch {
        /* ignore quota / private mode */
      }
    }
  }

  if (!isSupabaseOnlyMode()) {
    return parseFromRemote(loadWorkspaceJsonLocal(DASHBOARD_WIDGET_STORAGE_KEY));
  }

  return null;
}

export async function resolveDashboardWidgetUserAndRestaurant(): Promise<{
  profileId: string | null;
  restaurantId: string | null;
}> {
  if (!workspacePersistenceConfigured()) {
    return { profileId: null, restaurantId: null };
  }
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const restaurantId = await getWorkspaceRestaurantId();
  return { profileId: user?.id ?? null, restaurantId };
}
