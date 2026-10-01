import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import {
  liveActivityFeedNeedsRowFilter,
  liveActivityPayloadVisibleToViewer,
  liveFeedModulesForViewer,
  viewerHasFullLiveFeedAccess,
  type LiveActivityFeedViewer,
} from "@/lib/live-activity/live-activity-feed-access";
import { LIVE_ACTIVITY_FEED_MODULES } from "@/lib/live-activity/live-activity-feed-modules";
import { liveActivityFromNotificationEvent } from "@/lib/live-activity/live-activity-from-notification-event";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";
import { loadNotificationAccessContext } from "@/lib/notifications/notification-access-context";
import { isNotificationModuleId } from "@/lib/notifications/notification-modules";
import { hasModuleRead } from "@/lib/permissions/module-crud-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const ROW_FILTER_CHUNK = 80;
const ROW_FILTER_SCAN_CAP = 500;

const ACCOUNTING_FEED_MODULES = new Set([
  "accounting_voucher",
  "accounting_invoice",
  "accounting_quotation",
]);

type FeedEventRow = {
  id: string;
  module: string;
  reference_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

function personName(
  given: string | null | undefined,
  family: string | null | undefined,
  display?: string | null,
): string | null {
  const joined = [given, family]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
  if (joined) return joined;
  const fallback = display?.trim() ?? "";
  return fallback || null;
}

async function loadUploaderNames(
  admin: SupabaseClient,
  restaurantId: string,
  profileIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (profileIds.length === 0) return names;

  const [{ data: profileRows }, { data: staffRows }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, given_name, family_name, display_name")
      .in("id", profileIds),
    admin
      .from("restaurant_staff")
      .select("profile_id, given_name, family_name")
      .eq("restaurant_id", restaurantId)
      .in("profile_id", profileIds),
  ]);

  for (const raw of profileRows ?? []) {
    const row = raw as {
      id: string;
      given_name: string | null;
      family_name: string | null;
      display_name: string | null;
    };
    const name = personName(row.given_name, row.family_name, row.display_name);
    if (name) names.set(row.id, name);
  }

  for (const raw of staffRows ?? []) {
    const row = raw as {
      profile_id: string | null;
      given_name: string | null;
      family_name: string | null;
    };
    if (!row.profile_id) continue;
    const name = personName(row.given_name, row.family_name);
    if (name) names.set(row.profile_id, name);
  }

  return names;
}

function mapFeedRow(
  row: FeedEventRow,
  locale: string | null | undefined,
  uploaderNames: Map<string, string>,
): LiveActivityItem {
  const payload = { ...row.payload };
  if (ACCOUNTING_FEED_MODULES.has(row.module)) {
    const profileId = payload.createdByProfileId;
    const known =
      typeof profileId === "string" ? uploaderNames.get(profileId) : null;
    if (known) payload.uploaderName = known;
  }
  const mapped = liveActivityFromNotificationEvent({
    eventId: row.id,
    referenceId: row.reference_id ?? undefined,
    module: row.module,
    payload,
    createdAt: row.created_at,
    locale,
  });
  return {
    id: mapped.id ?? `evt:${row.id}`,
    kind: mapped.kind,
    module: mapped.module,
    title: mapped.title,
    description: mapped.description ?? null,
    href: mapped.href ?? null,
    at: mapped.at ?? row.created_at,
  };
}

function asFeedRow(raw: {
  id: string;
  module: string;
  reference_id: string | null;
  payload: unknown;
  created_at: string;
}): FeedEventRow {
  return {
    id: raw.id,
    module: raw.module,
    reference_id: raw.reference_id,
    payload:
      raw.payload && typeof raw.payload === "object"
        ? (raw.payload as Record<string, unknown>)
        : {},
    created_at: raw.created_at,
  };
}

export async function fetchLiveActivityFeed(params: {
  restaurantId: string;
  limit?: number;
  offset?: number;
  locale?: string | null;
  viewer: LiveActivityFeedViewer;
}): Promise<{
  ok: boolean;
  items: LiveActivityItem[];
  hasMore: boolean;
  total: number;
  viewer: LiveActivityFeedViewer;
}> {
  const empty = {
    ok: false,
    items: [] as LiveActivityItem[],
    hasMore: false,
    total: 0,
    viewer: params.viewer,
  };
  const admin = createSupabaseAdminClient();
  if (!admin) return empty;
  if (params.viewer.modules.length === 0) return { ...empty, ok: true };

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, params.limit ?? DEFAULT_LIMIT),
  );
  const offset = Math.max(0, params.offset ?? 0);
  const modules = [...params.viewer.modules];

  let rows: FeedEventRow[] = [];
  let hasMore = false;
  let total = 0;

  if (!liveActivityFeedNeedsRowFilter(params.viewer)) {
    const { data, error, count } = await admin
      .from("notification_events")
      .select("id, module, reference_id, payload, created_at", {
        count: "exact",
      })
      .eq("restaurant_id", params.restaurantId)
      .in("module", modules)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.warn("[live-activity-feed]", error.message);
      return empty;
    }
    rows = (data ?? []).map((raw) => asFeedRow(raw as FeedEventRow));
    total = count ?? rows.length;
    hasMore = offset + rows.length < total;
  } else {
    let dbFrom = 0;
    let skipped = 0;
    while (rows.length < limit && dbFrom < ROW_FILTER_SCAN_CAP) {
      const { data, error } = await admin
        .from("notification_events")
        .select("id, module, reference_id, payload, created_at")
        .eq("restaurant_id", params.restaurantId)
        .in("module", modules)
        .order("created_at", { ascending: false })
        .range(dbFrom, dbFrom + ROW_FILTER_CHUNK - 1);

      if (error) {
        console.warn("[live-activity-feed]", error.message);
        return empty;
      }
      const chunk = (data ?? []).map((raw) => asFeedRow(raw as FeedEventRow));
      if (chunk.length === 0) break;

      for (const row of chunk) {
        if (
          !liveActivityPayloadVisibleToViewer({
            module: row.module,
            payload: row.payload,
            userId: params.viewer.userId,
            viewerStaffId: params.viewer.viewerStaffId,
            shiftScope: params.viewer.shiftScope,
            unrestricted: params.viewer.unrestricted,
          })
        ) {
          continue;
        }
        if (skipped < offset) {
          skipped += 1;
          continue;
        }
        if (rows.length < limit) {
          rows.push(row);
          continue;
        }
        hasMore = true;
        break;
      }

      if (rows.length >= limit && chunk.length === ROW_FILTER_CHUNK) {
        hasMore = true;
      }
      if (hasMore || chunk.length < ROW_FILTER_CHUNK) break;
      dbFrom += chunk.length;
    }
    total = offset + rows.length + (hasMore ? 1 : 0);
  }

  const uploaderIds = [
    ...new Set(
      rows
        .filter((row) => ACCOUNTING_FEED_MODULES.has(row.module))
        .map((row) => row.payload.createdByProfileId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const uploaderNames = await loadUploaderNames(
    admin,
    params.restaurantId,
    uploaderIds,
  );

  return {
    ok: true,
    items: rows.map((row) => mapFeedRow(row, params.locale, uploaderNames)),
    hasMore,
    total,
    viewer: params.viewer,
  };
}

const UNRESTRICTED_VIEWER: LiveActivityFeedViewer = {
  userId: "",
  modules: LIVE_ACTIVITY_FEED_MODULES.filter(isNotificationModuleId),
  shiftScope: "team",
  viewerStaffId: null,
  unrestricted: true,
};

/** @deprecated Alias für Tests — heute = offset 0, limit 80, ohne Personenfilter. */
export async function fetchLiveActivityFeedToday(
  restaurantId: string,
): Promise<LiveActivityItem[]> {
  const { items } = await fetchLiveActivityFeed({
    restaurantId,
    limit: 80,
    offset: 0,
    viewer: UNRESTRICTED_VIEWER,
  });
  return items;
}

async function viewerIsOwner(
  sb: SupabaseClient,
  restaurantId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await sb
    .from("restaurant_employees")
    .select("role, restaurant_positions(slug)")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const positionSlug = (
    data as { restaurant_positions?: { slug?: string } | null } | null
  )?.restaurant_positions?.slug;
  const employeeRole = (data as { role?: string } | null)?.role;
  return positionSlug === "owner" || employeeRole === "owner";
}

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const restaurantId = searchParams.get("restaurantId");
  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const limit = Number(searchParams.get("limit"));
  const offset = Number(searchParams.get("offset"));

  const [{ access }, owner, profileRes, staffRes] = await Promise.all([
    loadNotificationAccessContext(auth.sb, {
      restaurantId: auth.restaurantId,
      userId: auth.userId,
    }),
    viewerIsOwner(auth.sb, auth.restaurantId, auth.userId),
    auth.sb.from("profiles").select("locale").eq("id", auth.userId).maybeSingle(),
    auth.sb
      .from("restaurant_staff")
      .select("id")
      .eq("restaurant_id", auth.restaurantId)
      .eq("profile_id", auth.userId)
      .maybeSingle(),
  ]);

  const has = owner ? () => true : access.has;
  const unrestricted = owner || viewerHasFullLiveFeedAccess(has);
  const modules = liveFeedModulesForViewer(
    { has, hasStaffProfile: access.hasStaffProfile },
    { unrestricted },
  );
  const viewer: LiveActivityFeedViewer = {
    userId: auth.userId,
    modules,
    shiftScope: hasModuleRead(has, "staff") ? "team" : "own",
    viewerStaffId: (staffRes.data as { id: string } | null)?.id ?? null,
    unrestricted,
  };

  const page = await fetchLiveActivityFeed({
    restaurantId: auth.restaurantId,
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
    locale:
      typeof profileRes.data?.locale === "string" ? profileRes.data.locale : null,
    viewer,
  });

  if (!page.ok) {
    return Response.json({ error: "feed_unavailable" }, { status: 503 });
  }

  return Response.json({
    data: page.items,
    hasMore: page.hasMore,
    total: page.total,
    access: {
      modules: page.viewer.modules,
      unrestricted: page.viewer.unrestricted,
      shiftScope: page.viewer.shiftScope,
      userId: page.viewer.userId,
      viewerStaffId: page.viewer.viewerStaffId,
    },
  });
}
