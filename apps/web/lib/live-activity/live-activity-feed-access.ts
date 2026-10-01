import { LIVE_ACTIVITY_FEED_MODULES } from "@/lib/live-activity/live-activity-feed-modules";
import {
  filterNotificationModulesForUser,
  isNotificationModuleVisibleForUser,
  type NotificationModuleAccessContext,
} from "@/lib/notifications/notification-module-permissions";
import {
  isNotificationModuleId,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
import {
  hasModuleRead,
  type ModuleCrudPrefix,
} from "@/lib/permissions/module-crud-permissions";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";

/** Modul-Rechte, die den Heute-Feed abdecken. Alle gesetzt = voller Zugriff. */
const LIVE_FEED_ACCESS_PREFIXES: readonly ModuleCrudPrefix[] = [
  "contacts",
  "reviews",
  "reservations",
  "events",
  "staff",
  "staff_todos",
  "inventory",
  "accounting",
];

const LIVE_FEED_MODULE_IDS: readonly NotificationModuleId[] =
  LIVE_ACTIVITY_FEED_MODULES.filter(isNotificationModuleId);

/**
 * Persönliche Hinweise: die Glocke zeigt sie nur der Zielperson.
 * Inhaber und voller Zugriff sehen sie trotzdem im ganzen Feed.
 */
const ROW_SCOPED_MODULES = new Set<string>([
  "staff_contract_signed",
  "staff_document_assigned",
  "staff_permissions_granted",
]);

export type LiveActivityFeedViewer = {
  userId: string;
  modules: readonly NotificationModuleId[];
  shiftScope: "team" | "own";
  viewerStaffId: string | null;
  /** Inhaber oder alle Modul-Rechte: der ganze Feed, ohne Zeilenfilter. */
  unrestricted: boolean;
};

export function viewerHasFullLiveFeedAccess(
  has: (key: RestaurantPermissionKey) => boolean,
): boolean {
  return LIVE_FEED_ACCESS_PREFIXES.every((prefix) => hasModuleRead(has, prefix));
}

export function liveFeedModulesForViewer(
  ctx: NotificationModuleAccessContext,
  options?: { unrestricted?: boolean },
): NotificationModuleId[] {
  if (options?.unrestricted || viewerHasFullLiveFeedAccess(ctx.has)) {
    return [...LIVE_FEED_MODULE_IDS];
  }
  return filterNotificationModulesForUser(LIVE_FEED_MODULE_IDS, ctx);
}

export function liveActivityFeedNeedsRowFilter(viewer: {
  unrestricted: boolean;
  shiftScope: "team" | "own";
  modules: readonly string[];
}): boolean {
  if (viewer.unrestricted) return false;
  if (
    viewer.shiftScope === "own" &&
    viewer.modules.some(
      (module) =>
        module === "staff_shift_start" || module === "staff_shift_end",
    )
  ) {
    return true;
  }
  return viewer.modules.some((module) => ROW_SCOPED_MODULES.has(module));
}

function payloadString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Zeile sichtbar für diesen Mitarbeiter — Modulrecht prüft der Aufrufer separat. */
export function liveActivityPayloadVisibleToViewer(params: {
  module: string;
  payload: Record<string, unknown>;
  userId: string;
  viewerStaffId: string | null;
  shiftScope: "team" | "own";
  unrestricted: boolean;
}): boolean {
  if (params.unrestricted) return true;

  if (ROW_SCOPED_MODULES.has(params.module)) {
    return payloadString(params.payload, "targetProfileId") === params.userId;
  }

  if (
    params.module === "staff_shift_start" ||
    params.module === "staff_shift_end"
  ) {
    if (params.shiftScope === "team") return true;
    const assigned = payloadString(params.payload, "assignedProfileId");
    if (assigned && assigned === params.userId) return true;
    const staffId = payloadString(params.payload, "staffId");
    return Boolean(params.viewerStaffId && staffId === params.viewerStaffId);
  }

  return true;
}

/**
 * Client-Filter, solange das Mitarbeiterprofil noch nicht bekannt ist.
 * `staffProfile`-Module bleiben sichtbar; Modul-Rechte (Belege, Stempel) nicht.
 */
export function liveFeedModuleVisibleWithPermissions(
  module: string | undefined,
  has: (key: RestaurantPermissionKey) => boolean,
): boolean {
  if (!module || !isNotificationModuleId(module)) return true;
  if (viewerHasFullLiveFeedAccess(has)) return true;
  return isNotificationModuleVisibleForUser(module, {
    has,
    hasStaffProfile: true,
  });
}
