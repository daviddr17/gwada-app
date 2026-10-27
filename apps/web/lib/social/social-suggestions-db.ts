import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SOCIAL_SLOT_KINDS,
  SOCIAL_TEMPLATE_IDS,
  type SocialSlotKind,
  type SocialTemplateId,
} from "@/lib/social/social-brand-kit";
import type { SocialFeedLayoutId } from "@/lib/social/social-feed-brand-system";
import { overlayLineFromCaption } from "@/lib/social/social-caption-templates";
import {
  feedLayoutToLegacyTemplate,
  resolveSuggestionFeedLayout,
} from "@/lib/social/social-feed-layout";
import { selectStaleOrDuplicateHolidayIdsToSkip } from "@/lib/social/social-autopilot-dedupe";
import {
  SOCIAL_SUGGESTION_STATUSES,
  type SocialMediaTask,
  type SocialPostSuggestion,
  type SocialSuggestionAsset,
  type SocialSuggestionStatus,
} from "@/lib/social/social-suggestion-types";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

function parseAsset(raw: unknown): SocialSuggestionAsset {
  if (!raw || typeof raw !== "object") {
    return { imageUrl: null, source: "none" };
  }
  const r = raw as Record<string, unknown>;
  const imageUrl =
    typeof r.imageUrl === "string" && r.imageUrl.trim()
      ? r.imageUrl.trim()
      : typeof r.image_url === "string" && r.image_url.trim()
        ? r.image_url.trim()
        : null;
  const source =
    r.source === "gallery" ||
    r.source === "menu" ||
    r.source === "profile" ||
    r.source === "event" ||
    r.source === "none"
      ? r.source
      : "none";
  return {
    imageUrl,
    imageLabel:
      typeof r.imageLabel === "string"
        ? r.imageLabel
        : typeof r.image_label === "string"
          ? r.image_label
          : undefined,
    source,
    sourceId:
      typeof r.sourceId === "string"
        ? r.sourceId
        : typeof r.source_id === "string"
          ? r.source_id
          : undefined,
    storageBucket:
      typeof r.storageBucket === "string"
        ? r.storageBucket
        : typeof r.storage_bucket === "string"
          ? r.storage_bucket
          : undefined,
    storagePath:
      typeof r.storagePath === "string"
        ? r.storagePath
        : typeof r.storage_path === "string"
          ? r.storage_path
          : undefined,
  };
}

function mapSuggestionRow(row: Record<string, unknown>): SocialPostSuggestion | null {
  const id = typeof row.id === "string" ? row.id : "";
  const restaurantId =
    typeof row.restaurant_id === "string" ? row.restaurant_id : "";
  if (!id || !restaurantId) return null;

  const status = SOCIAL_SUGGESTION_STATUSES.includes(
    row.status as SocialSuggestionStatus,
  )
    ? (row.status as SocialSuggestionStatus)
    : "pending";
  const slotKind = SOCIAL_SLOT_KINDS.includes(row.slot_kind as SocialSlotKind)
    ? (row.slot_kind as SocialSlotKind)
    : "brand";
  const templateId = SOCIAL_TEMPLATE_IDS.includes(
    row.template_id as SocialTemplateId,
  )
    ? (row.template_id as SocialTemplateId)
    : "brand_card";
  const source =
    row.source_json && typeof row.source_json === "object"
      ? (row.source_json as Record<string, unknown>)
      : {};

  return {
    id,
    restaurantId,
    status,
    slotKind,
    templateId,
    feedLayout: resolveSuggestionFeedLayout({
      slotKind,
      templateId,
      source,
    }),
    plannedAt:
      typeof row.planned_at === "string"
        ? row.planned_at
        : new Date().toISOString(),
    title: typeof row.title === "string" ? row.title : null,
    caption: typeof row.caption === "string" ? row.caption : "",
    platforms: Array.isArray(row.platforms)
      ? row.platforms.filter((p): p is string => typeof p === "string")
      : ["facebook", "instagram"],
    source,
    asset: parseAsset(row.asset_json),
    newsPostId: typeof row.news_post_id === "string" ? row.news_post_id : null,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date().toISOString(),
  };
}

export async function listSocialSuggestionsFromDb(
  sb: SupabaseClient,
  restaurantId: string,
  opts?: { statuses?: SocialSuggestionStatus[]; limit?: number },
): Promise<SocialPostSuggestion[]> {
  if (!isUuidRestaurantId(restaurantId)) return [];
  const statuses = opts?.statuses ?? ["pending", "needs_asset"];
  const limit = opts?.limit ?? 40;

  const { data, error } = await sb
    .from("social_post_suggestions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .in("status", statuses)
    .order("planned_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.warn("[gwada] listSocialSuggestionsFromDb", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => mapSuggestionRow(row as Record<string, unknown>))
    .filter((x): x is SocialPostSuggestion => x != null);
}

export async function insertSocialSuggestionsInDb(
  sb: SupabaseClient,
  rows: Array<{
    restaurantId: string;
    status: SocialSuggestionStatus;
    slotKind: SocialSlotKind;
    templateId: SocialTemplateId;
    plannedAt: string;
    title: string | null;
    caption: string;
    platforms: string[];
    source: Record<string, unknown>;
    asset: SocialSuggestionAsset;
  }>,
): Promise<{ count: number; ids: string[] }> {
  if (rows.length === 0) return { count: 0, ids: [] };
  const payload = rows.map((r) => ({
    restaurant_id: r.restaurantId,
    status: r.status,
    slot_kind: r.slotKind,
    template_id: r.templateId,
    planned_at: r.plannedAt,
    title: r.title,
    caption: r.caption,
    platforms: r.platforms,
    source_json: r.source,
    asset_json: r.asset,
  }));

  const { data, error } = await sb
    .from("social_post_suggestions")
    .insert(payload)
    .select("id");

  if (error) {
    console.warn("[gwada] insertSocialSuggestionsInDb", error.message);
    return { count: 0, ids: [] };
  }
  const ids = (data ?? [])
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean);
  return { count: ids.length, ids };
}

/**
 * Offene Vorschläge verwerfen (z. B. vor „Neu vorschlagen“).
 * Ohne `suggestionIds`: alle pending/needs_asset des Restaurants — vermeidet
 * Duplikat-Akkumulation, wenn die ID-Liste unvollständig wäre.
 */

/**
 * Soft-skip: abgelaufene / doppelte Feiertags-Drafts (pending|needs_asset → skipped).
 * Verhindert Historien-Spam wie 100× „Maria Himmelfahrt“ in der Entwurfsliste.
 */
export async function pruneStaleHolidaySocialSuggestionsInDb(
  sb: SupabaseClient,
  restaurantId: string,
  opts?: { now?: Date; lookaheadDays?: number; fetchLimit?: number },
): Promise<number> {
  if (!isUuidRestaurantId(restaurantId)) return 0;
  const open = await listSocialSuggestionsFromDb(sb, restaurantId, {
    statuses: ["pending", "needs_asset"],
    limit: opts?.fetchLimit ?? 500,
  });
  const ids = selectStaleOrDuplicateHolidayIdsToSkip(open, {
    now: opts?.now,
    lookaheadDays: opts?.lookaheadDays,
  });
  if (ids.length === 0) return 0;
  return skipPendingSocialSuggestionsInDb(sb, restaurantId, ids);
}

export async function skipPendingSocialSuggestionsInDb(
  sb: SupabaseClient,
  restaurantId: string,
  suggestionIds?: string[],
): Promise<number> {
  if (!isUuidRestaurantId(restaurantId)) return 0;
  if (suggestionIds && suggestionIds.length === 0) return 0;

  let query = sb
    .from("social_post_suggestions")
    .update({ status: "skipped" })
    .eq("restaurant_id", restaurantId)
    .in("status", ["pending", "needs_asset"]);

  if (suggestionIds && suggestionIds.length > 0) {
    query = query.in("id", suggestionIds);
  }

  const { data, error } = await query.select("id");
  if (error) {
    console.warn("[gwada] skipPendingSocialSuggestionsInDb", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export async function updateSocialSuggestionStatusInDb(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    suggestionId: string;
    status: SocialSuggestionStatus;
    newsPostId?: string | null;
    caption?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch: Record<string, unknown> = { status: params.status };
  if (params.newsPostId !== undefined) patch.news_post_id = params.newsPostId;
  if (params.caption !== undefined) patch.caption = params.caption;

  const { error } = await sb
    .from("social_post_suggestions")
    .update(patch)
    .eq("id", params.suggestionId)
    .eq("restaurant_id", params.restaurantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateSocialSuggestionFieldsInDb(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    suggestionId: string;
    title?: string | null;
    caption?: string;
    asset?: SocialSuggestionAsset;
    feedLayout?: SocialFeedLayoutId;
    status?: SocialSuggestionStatus;
    platforms?: string[];
    mediaFormat?: string | null;
  },
): Promise<
  | { ok: true; suggestion: SocialPostSuggestion }
  | { ok: false; error: string }
> {
  const existing = await fetchSocialSuggestionFromDb(
    sb,
    params.restaurantId,
    params.suggestionId,
  );
  if (!existing) return { ok: false, error: "not_found" };
  if (
    existing.status !== "pending" &&
    existing.status !== "needs_asset" &&
    existing.status !== "saved"
  ) {
    return { ok: false, error: "invalid_status" };
  }

  const patch: Record<string, unknown> = {};
  if (params.title !== undefined) {
    const t = params.title?.trim() ?? "";
    patch.title = t ? t.slice(0, 120) : null;
  }
  let nextSource: Record<string, unknown> | null = null;
  if (params.caption !== undefined) {
    const caption = params.caption.slice(0, 4000);
    patch.caption = caption;
    nextSource = {
      ...existing.source,
      overlayLine: overlayLineFromCaption(caption),
    };
  }
  if (params.asset !== undefined) {
    patch.asset_json = params.asset;
    if (existing.status !== "saved") {
      patch.status =
        params.asset.imageUrl || params.status === "pending"
          ? "pending"
          : "needs_asset";
    }
  }
  if (params.status !== undefined && params.asset === undefined) {
    patch.status = params.status;
  }
  if (params.platforms !== undefined) {
    patch.platforms = params.platforms.slice(0, 8);
  }
  if (params.feedLayout !== undefined) {
    patch.template_id = feedLayoutToLegacyTemplate(params.feedLayout);
    nextSource = {
      ...(nextSource ?? existing.source),
      feedLayout: params.feedLayout,
    };
  }
  if (params.mediaFormat !== undefined) {
    nextSource = {
      ...(nextSource ?? existing.source),
      mediaFormat: params.mediaFormat,
    };
  }
  if (nextSource) {
    patch.source_json = nextSource;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, suggestion: existing };
  }

  const { data, error } = await sb
    .from("social_post_suggestions")
    .update(patch)
    .eq("id", params.suggestionId)
    .eq("restaurant_id", params.restaurantId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  const mapped = data
    ? mapSuggestionRow(data as Record<string, unknown>)
    : null;
  if (!mapped) return { ok: false, error: "update_failed" };
  return { ok: true, suggestion: mapped };
}

export async function fetchSocialSuggestionFromDb(
  sb: SupabaseClient,
  restaurantId: string,
  suggestionId: string,
): Promise<SocialPostSuggestion | null> {
  const { data, error } = await sb
    .from("social_post_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) return null;
  return mapSuggestionRow(data as Record<string, unknown>);
}

function mapTaskRow(row: Record<string, unknown>): SocialMediaTask | null {
  const id = typeof row.id === "string" ? row.id : "";
  const restaurantId =
    typeof row.restaurant_id === "string" ? row.restaurant_id : "";
  if (!id || !restaurantId) return null;
  const kind =
    row.kind === "upload_photos" || row.kind === "mark_heroes"
      ? row.kind
      : "upload_photos";
  const status =
    row.status === "done" || row.status === "dismissed" || row.status === "open"
      ? row.status
      : "open";
  return {
    id,
    restaurantId,
    kind,
    status,
    title: typeof row.title === "string" ? row.title : "",
    body: typeof row.body === "string" ? row.body : "",
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date().toISOString(),
  };
}

export async function listOpenSocialTasksFromDb(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<SocialMediaTask[]> {
  if (!isUuidRestaurantId(restaurantId)) return [];
  const { data, error } = await sb
    .from("social_media_tasks")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.warn("[gwada] listOpenSocialTasksFromDb", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => mapTaskRow(row as Record<string, unknown>))
    .filter((x): x is SocialMediaTask => x != null);
}

export async function ensureSocialUploadTaskInDb(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<void> {
  const existing = await listOpenSocialTasksFromDb(sb, restaurantId);
  if (existing.some((t) => t.kind === "upload_photos")) return;

  const { error } = await sb.from("social_media_tasks").insert({
    restaurant_id: restaurantId,
    kind: "upload_photos",
    status: "open",
    title: "3 starke Fotos hochladen",
    body: "Bitte lade Fotos hoch: 1× Gericht/Teller, 1× Theke oder Raum, 1× Außenansicht oder Terrasse. Dann markiere sie in der Galerie oder im Brand Kit als Favoriten.",
  });

  if (error) {
    console.warn("[gwada] ensureSocialUploadTaskInDb", error.message);
  }
}

/** Entwurf als Vorlage speichern — bleibt parallel zu neuen Ideen nutzbar. */
export async function saveSocialSuggestionAsTemplateInDb(
  sb: SupabaseClient,
  params: { restaurantId: string; suggestionId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  return updateSocialSuggestionStatusInDb(sb, {
    restaurantId: params.restaurantId,
    suggestionId: params.suggestionId,
    status: "saved",
  });
}

/** Gespeicherte Vorlage wieder in die Freigabe-Queue holen. */
export async function restoreSavedSocialSuggestionInDb(
  sb: SupabaseClient,
  params: { restaurantId: string; suggestionId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await fetchSocialSuggestionFromDb(
    sb,
    params.restaurantId,
    params.suggestionId,
  );
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.status !== "saved") return { ok: false, error: "invalid_status" };
  const nextStatus =
    existing.asset.imageUrl ? "pending" : "needs_asset";
  return updateSocialSuggestionStatusInDb(sb, {
    restaurantId: params.restaurantId,
    suggestionId: params.suggestionId,
    status: nextStatus,
  });
}

export async function completeSocialTaskInDb(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    taskId: string;
    status: "done" | "dismissed";
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await sb
    .from("social_media_tasks")
    .update({
      status: params.status,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.taskId)
    .eq("restaurant_id", params.restaurantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
