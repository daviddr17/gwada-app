import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SOCIAL_SLOT_KINDS,
  SOCIAL_TEMPLATE_IDS,
  type SocialSlotKind,
  type SocialTemplateId,
} from "@/lib/social/social-brand-kit";
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

  return {
    id,
    restaurantId,
    status,
    slotKind,
    templateId,
    plannedAt:
      typeof row.planned_at === "string"
        ? row.planned_at
        : new Date().toISOString(),
    title: typeof row.title === "string" ? row.title : null,
    caption: typeof row.caption === "string" ? row.caption : "",
    platforms: Array.isArray(row.platforms)
      ? row.platforms.filter((p): p is string => typeof p === "string")
      : ["facebook", "instagram"],
    source:
      row.source_json && typeof row.source_json === "object"
        ? (row.source_json as Record<string, unknown>)
        : {},
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
): Promise<number> {
  if (rows.length === 0) return 0;
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
