import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import {
  liveActivityFeedNeedsRowFilter,
  liveActivityPayloadVisibleToViewer,
  liveFeedModulesForViewer,
  viewerHasFullLiveFeedAccess,
  type LiveActivityFeedViewer,
} from "@/lib/live-activity/live-activity-feed-access";
import {
  accountingProfileIdFromPayload,
  asUuid,
  firstNamedProfileId,
  isLexofficeDocumentSource,
  personNameFromParts,
  resolveAccountingUploaderName,
} from "@/lib/live-activity/live-activity-accounting-uploader";
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

const ACCOUNTING_DOCUMENT_SOURCE: Record<
  string,
  { table: "accounting_vouchers" | "accounting_invoices" | "accounting_quotations"; kind: string }
> = {
  accounting_voucher: { table: "accounting_vouchers", kind: "voucher" },
  accounting_invoice: { table: "accounting_invoices", kind: "invoice" },
  accounting_quotation: { table: "accounting_quotations", kind: "quotation" },
};

type FeedEventRow = {
  id: string;
  module: string;
  reference_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

function rememberName(
  names: Map<string, string>,
  profileId: string | null,
  name: string | null,
) {
  if (!profileId || !name) return;
  names.set(profileId, name);
}

async function loadUploaderNames(
  admin: SupabaseClient,
  restaurantId: string,
  profileIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = [...new Set(profileIds.map((id) => id.toLowerCase()))];
  if (ids.length === 0) return names;

  const [profiles, staff, employees] = await Promise.all([
    admin
      .from("profiles")
      .select("id, given_name, family_name, display_name, nickname")
      .in("id", ids),
    admin
      .from("restaurant_staff")
      .select("profile_id, given_name, family_name")
      .eq("restaurant_id", restaurantId)
      .in("profile_id", ids),
    admin
      .from("restaurant_employees")
      .select("id, profile_id, staff_id")
      .eq("restaurant_id", restaurantId)
      .in("profile_id", ids),
  ]);

  if (profiles.error) {
    console.warn("[live-activity-feed] uploader profiles", profiles.error.message);
  }
  if (staff.error) {
    console.warn("[live-activity-feed] uploader staff", staff.error.message);
  }
  if (employees.error) {
    console.warn(
      "[live-activity-feed] uploader employees",
      employees.error.message,
    );
  }

  for (const raw of profiles.data ?? []) {
    const row = raw as {
      id: string;
      given_name: string | null;
      family_name: string | null;
      display_name: string | null;
      nickname: string | null;
    };
    rememberName(
      names,
      asUuid(row.id),
      personNameFromParts(row.given_name, row.family_name, [
        row.display_name,
        row.nickname,
      ]),
    );
  }

  const employeeRows = (employees.data ?? []).map((raw) => {
    const row = raw as { id?: unknown; profile_id?: unknown; staff_id?: unknown };
    return {
      id: asUuid(row.id),
      profileId: asUuid(row.profile_id),
      staffId: asUuid(row.staff_id),
    };
  });
  const staffIds = [
    ...new Set(
      employeeRows
        .map((row) => row.staffId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const employeeIds = [
    ...new Set(
      employeeRows
        .map((row) => row.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const staffNameById = new Map<string, string>();
  const staffNameByEmployeeId = new Map<string, string>();
  if (employeeIds.length > 0) {
    const linkedByEmployee = await admin
      .from("restaurant_staff")
      .select("employee_id, given_name, family_name")
      .eq("restaurant_id", restaurantId)
      .in("employee_id", employeeIds);
    if (linkedByEmployee.error) {
      console.warn(
        "[live-activity-feed] uploader staff by employee",
        linkedByEmployee.error.message,
      );
    }
    for (const raw of linkedByEmployee.data ?? []) {
      const row = raw as {
        employee_id?: unknown;
        given_name: string | null;
        family_name: string | null;
      };
      const employeeId = asUuid(row.employee_id);
      const name = personNameFromParts(row.given_name, row.family_name);
      if (employeeId && name) staffNameByEmployeeId.set(employeeId, name);
    }
  }
  if (staffIds.length > 0) {
    const linked = await admin
      .from("restaurant_staff")
      .select("id, given_name, family_name")
      .eq("restaurant_id", restaurantId)
      .in("id", staffIds);
    if (linked.error) {
      console.warn("[live-activity-feed] uploader linked staff", linked.error.message);
    }
    for (const raw of linked.data ?? []) {
      const row = raw as {
        id: string;
        given_name: string | null;
        family_name: string | null;
      };
      const id = asUuid(row.id);
      const name = personNameFromParts(row.given_name, row.family_name);
      if (id && name) staffNameById.set(id, name);
    }
  }

  for (const row of employeeRows) {
    if (!row.profileId) continue;
    const fromEmployee = row.id ? staffNameByEmployeeId.get(row.id) ?? null : null;
    const fromStaff = row.staffId ? staffNameById.get(row.staffId) ?? null : null;
    rememberName(names, row.profileId, fromStaff ?? fromEmployee);
  }

  for (const raw of staff.data ?? []) {
    const row = raw as {
      profile_id: string | null;
      given_name: string | null;
      family_name: string | null;
    };
    rememberName(
      names,
      asUuid(row.profile_id),
      personNameFromParts(row.given_name, row.family_name),
    );
  }

  return names;
}

type DocumentActors = {
  createdBy: string | null;
  updatedBy: string | null;
  source: string | null;
};

async function loadDocumentActors(
  admin: SupabaseClient,
  restaurantId: string,
  rows: FeedEventRow[],
): Promise<Map<string, DocumentActors>> {
  const byDocumentId = new Map<string, DocumentActors>();
  const idsByTable = new Map<
    (typeof ACCOUNTING_DOCUMENT_SOURCE)[string]["table"],
    string[]
  >();

  for (const row of rows) {
    if (!ACCOUNTING_FEED_MODULES.has(row.module)) continue;
    const documentId = asUuid(row.reference_id);
    const source = ACCOUNTING_DOCUMENT_SOURCE[row.module];
    if (!documentId || !source) continue;
    const list = idsByTable.get(source.table) ?? [];
    list.push(documentId);
    idsByTable.set(source.table, list);
  }

  await Promise.all(
    [...idsByTable.entries()].map(async ([table, ids]) => {
      const { data, error } = await admin
        .from(table)
        .select("id, created_by, updated_by, source")
        .eq("restaurant_id", restaurantId)
        .in("id", [...new Set(ids)]);
      if (error) {
        console.warn("[live-activity-feed] uploader document", table, error.message);
        return;
      }
      for (const raw of data ?? []) {
        const row = raw as {
          id?: unknown;
          created_by?: unknown;
          updated_by?: unknown;
          source?: unknown;
        };
        const documentId = asUuid(row.id);
        if (!documentId) continue;
        byDocumentId.set(documentId, {
          createdBy: asUuid(row.created_by),
          updatedBy: asUuid(row.updated_by),
          source: typeof row.source === "string" ? row.source : null,
        });
      }
    }),
  );

  return byDocumentId;
}

async function loadLogUploaders(
  admin: SupabaseClient,
  restaurantId: string,
  rows: FeedEventRow[],
): Promise<Map<string, { name: string | null; actorId: string | null }>> {
  const byEventId = new Map<string, { name: string | null; actorId: string | null }>();
  const idsByKind = new Map<string, string[]>();
  const eventIdsByDocument = new Map<string, string[]>();

  for (const row of rows) {
    const source = ACCOUNTING_DOCUMENT_SOURCE[row.module];
    const documentId = asUuid(row.reference_id);
    if (!source || !documentId) continue;
    const list = idsByKind.get(source.kind) ?? [];
    list.push(documentId);
    idsByKind.set(source.kind, list);
    const key = `${source.kind}:${documentId}`;
    const events = eventIdsByDocument.get(key) ?? [];
    events.push(row.id);
    eventIdsByDocument.set(key, events);
  }

  const chosen = new Map<
    string,
    { action: string; name: string | null; actorId: string | null }
  >();

  await Promise.all(
    [...idsByKind.entries()].map(async ([kind, ids]) => {
      const { data, error } = await admin
        .from("accounting_document_log_entries")
        .select("document_id, actor_user_id, action, details, created_at")
        .eq("restaurant_id", restaurantId)
        .eq("document_kind", kind)
        .in("document_id", [...new Set(ids)])
        .in("action", ["created", "attachment_uploaded"])
        .order("created_at", { ascending: true });
      if (error) {
        console.warn("[live-activity-feed] uploader log", kind, error.message);
        return;
      }
      for (const raw of data ?? []) {
        const row = raw as {
          document_id?: unknown;
          actor_user_id?: unknown;
          action?: unknown;
          details?: unknown;
        };
        const documentId = asUuid(row.document_id);
        const action = typeof row.action === "string" ? row.action : "";
        const details =
          row.details && typeof row.details === "object"
            ? (row.details as Record<string, unknown>)
            : {};
        const name = personNameFromParts(
          typeof details.actorGivenName === "string" ? details.actorGivenName : null,
          typeof details.actorFamilyName === "string"
            ? details.actorFamilyName
            : null,
        );
        const actorId = asUuid(row.actor_user_id);
        if (!documentId || (!name && !actorId)) continue;
        const key = `${kind}:${documentId}`;
        const current = chosen.get(key);
        if (current?.action === "created" && action !== "created") continue;
        chosen.set(key, { action, name, actorId });
      }
    }),
  );

  for (const [key, picked] of chosen) {
    for (const eventId of eventIdsByDocument.get(key) ?? []) {
      byEventId.set(eventId, { name: picked.name, actorId: picked.actorId });
    }
  }

  return byEventId;
}

type AccountingUploaderIndex = {
  profileIdByEvent: Map<string, string>;
  logNameByEvent: Map<string, string>;
  names: Map<string, string>;
  /** Beleg-Zeilen, deren Dokument source = lexoffice hat. */
  lexofficeEventIds: Set<string>;
};

async function buildAccountingUploaderIndex(
  admin: SupabaseClient,
  restaurantId: string,
  rows: FeedEventRow[],
): Promise<AccountingUploaderIndex> {
  const accountingRows = rows.filter((row) =>
    ACCOUNTING_FEED_MODULES.has(row.module),
  );
  const profileIdByEvent = new Map<string, string>();
  const lexofficeEventIds = new Set<string>();
  const actors = await loadDocumentActors(admin, restaurantId, accountingRows);
  const candidatesByEvent = new Map<string, Array<string | null>>();

  for (const row of accountingRows) {
    const documentId = asUuid(row.reference_id);
    const doc = documentId ? actors.get(documentId) : undefined;
    candidatesByEvent.set(row.id, [
      accountingProfileIdFromPayload(row.payload),
      doc?.createdBy ?? null,
      doc?.updatedBy ?? null,
    ]);
    if (
      row.module === "accounting_voucher" &&
      isLexofficeDocumentSource(doc?.source)
    ) {
      lexofficeEventIds.add(row.id);
    }
  }

  const names = await loadUploaderNames(admin, restaurantId, [
    ...[...candidatesByEvent.values()].flat(),
  ].filter((id): id is string => Boolean(id)));

  for (const [eventId, candidates] of candidatesByEvent) {
    const profileId = firstNamedProfileId(candidates, names);
    if (profileId) profileIdByEvent.set(eventId, profileId);
  }

  const unnamed = accountingRows.filter((row) => {
    return !resolveAccountingUploaderName({
      payload: row.payload,
      profileId: profileIdByEvent.get(row.id) ?? null,
      namesByProfileId: names,
    });
  });
  const logs =
    unnamed.length > 0
      ? await loadLogUploaders(admin, restaurantId, unnamed)
      : new Map<string, { name: string | null; actorId: string | null }>();

  const extraIds: string[] = [];
  const logNameByEvent = new Map<string, string>();
  for (const [eventId, log] of logs) {
    if (log.name) logNameByEvent.set(eventId, log.name);
    if (!log.actorId || profileIdByEvent.has(eventId)) continue;
    profileIdByEvent.set(eventId, log.actorId);
    if (!names.has(log.actorId)) extraIds.push(log.actorId);
  }
  if (extraIds.length > 0) {
    const more = await loadUploaderNames(admin, restaurantId, extraIds);
    for (const [id, name] of more) names.set(id, name);
  }

  return { profileIdByEvent, logNameByEvent, names, lexofficeEventIds };
}

function mapFeedRow(
  row: FeedEventRow,
  locale: string | null | undefined,
  uploaders: AccountingUploaderIndex,
): LiveActivityItem {
  const payload = { ...row.payload };
  if (ACCOUNTING_FEED_MODULES.has(row.module)) {
    const uploaderName = resolveAccountingUploaderName({
      payload,
      profileId: uploaders.profileIdByEvent.get(row.id) ?? null,
      namesByProfileId: uploaders.names,
      logName: uploaders.logNameByEvent.get(row.id) ?? null,
    });
    if (uploaderName) payload.uploaderName = uploaderName;
    if (row.module === "accounting_voucher") {
      payload.source = uploaders.lexofficeEventIds.has(row.id)
        ? "lexoffice"
        : "gwada";
    }
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

  const uploaders = await buildAccountingUploaderIndex(
    admin,
    params.restaurantId,
    rows,
  );

  return {
    ok: true,
    items: rows.map((row) => mapFeedRow(row, params.locale, uploaders)),
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
